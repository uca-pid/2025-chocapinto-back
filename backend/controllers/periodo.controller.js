const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { computeNewXpAndLevel, XP_PER_BOOK_FINISHED } = require('../utils/XPSystem');
const { notificarMiembrosClub, crearNotificacion } = require('./notificaciones.controller');
const { otorgarXP } = require('../utils/XPRewards');

/**
 * Obtiene el estado actual del club
 * Ruta: GET /api/club/:clubId/estado-actual
 */
const obtenerEstadoActual = async (req, res) => {
    try {
        const clubId = parseInt(req.params.clubId);

        await verificarYCerrarVencimientos(clubId);

        let periodoActivo = await prisma.periodoLectura.findFirst({
            where: {
                clubId: clubId,
                estado: 'VOTACION'
            },
            include: {
                opciones: {
                    include: {
                        clubBook: {
                            include: {
                                book: true
                            }
                        },
                        votos: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        username: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (periodoActivo) {
            const opcionesConVotos = periodoActivo.opciones.map(opcion => ({
                ...opcion,
                totalVotos: opcion.votos.length,
                votantes: opcion.votos.map(voto => voto.user.username)
            }));

            return res.json({
                success: true,
                estado: 'VOTACION',
                periodo: {
                    ...periodoActivo,
                    opciones: opcionesConVotos,
                    totalVotosEmitidos: opcionesConVotos.reduce((sum, op) => sum + op.totalVotos, 0)
                }
            });
        }

        periodoActivo = await prisma.periodoLectura.findFirst({
            where: {
                clubId: clubId,
                estado: 'LEYENDO'
            },
            include: {
                libroGanador: {
                    include: {
                        book: true
                    }
                }
            }
        });

        if (periodoActivo) {
            return res.json({
                success: true,
                estado: 'LEYENDO',
                periodo: periodoActivo
            });
        }

        return res.json({
            success: true,
            estado: 'INACTIVO',
            periodo: null
        });

    } catch (error) {
        console.error('[ERROR] Error al obtener estado actual:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

/**
 * Crear nuevo período de lectura con votación
 * Ruta: POST /api/club/:clubId/periodos
 */
const crearPeriodo = async (req, res) => {
    try {
        const clubId = parseInt(req.params.clubId);
        const { nombre, fechaFinVotacion, fechaFinLectura, clubBookIds, username } = req.body;

        const club = await prisma.club.findUnique({
            where: { id: clubId }
        });
        
        if (!club) {
            return res.status(404).json({
                success: false,
                message: `Club con ID ${clubId} no encontrado`
            });
        }
        const user = await prisma.user.findUnique({
            where: { username: username }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        // Verificar que sea owner o moderador
        const clubMember = await prisma.clubMember.findFirst({
            where: {
                userId: user.id,
                clubId: clubId
            }
        });

        const isOwner = await prisma.club.findFirst({
            where: { id: clubId, id_owner: user.id }
        });
        const periodoExistente = await prisma.periodoLectura.findFirst({
            where: {
                clubId: clubId,
                estado: {
                    in: ['VOTACION', 'LEYENDO']
                }
            }
        });

        if (periodoExistente) {
            return res.status(400).json({
                success: false,
                message: `Ya existe un período activo en estado ${periodoExistente.estado}`
            });
        }

        const fechaVotacion = new Date(fechaFinVotacion);
        const fechaLectura = new Date(fechaFinLectura);
        const ahora = new Date();

        if (fechaVotacion <= ahora) {
            return res.status(400).json({
                success: false,
                message: "La fecha de fin de votación debe ser futura"
            });
        }

        if (fechaLectura <= fechaVotacion) {
            return res.status(400).json({
                success: false,
                message: "La fecha de fin de lectura debe ser posterior a la votación"
            });
        }

        const librosDisponibles = await prisma.clubBook.findMany({
            where: {
                id: { in: clubBookIds },
                clubId: clubId,
                estado: 'por_leer'
            },
            include: {
                book: true
            }
        });

        if (librosDisponibles.length !== clubBookIds.length) {
            const librosEncontrados = librosDisponibles.map(l => l.id);
            const librosFaltantes = clubBookIds.filter(id => !librosEncontrados.includes(parseInt(id)));
            
            return res.status(400).json({
                success: false,
                message: `Algunos libros no están disponibles o no están en estado 'por leer'`,
                librosFaltantes: librosFaltantes,
                librosDisponibles: librosEncontrados
            });
        }

        const nuevoPeriodo = await prisma.periodoLectura.create({
            data: {
                clubId: clubId,
                nombre: nombre,
                estado: 'VOTACION',
                fechaFinVotacion: fechaVotacion,
                fechaFinLectura: fechaLectura,
                opciones: {
                    create: clubBookIds.map(clubBookId => ({
                        clubBookId: parseInt(clubBookId)
                    }))
                }
            },
            include: {
                opciones: {
                    include: {
                        clubBook: {
                            include: {
                                book: true
                            }
                        }
                    }
                }
            }
        });

        try {
            const fechaFormateada = new Date(fechaFinVotacion).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const librosNombres = nuevoPeriodo.opciones
                .map(o => o.clubBook.book.title)
                .join(', ');

            await notificarMiembrosClub(
                clubId,
                'VOTACION_ABIERTA',
                'Nueva votación abierta',
                `Se ha iniciado una votación para el período "${nombre}". Los libros disponibles son: ${librosNombres}. La votación cierra el ${fechaFormateada}.`,
                {
                    periodoId: nuevoPeriodo.id,
                    nombre: nombre,
                    fechaFinVotacion: fechaFinVotacion,
                    clubName: club.name,
                    libros: nuevoPeriodo.opciones.map(o => ({
                        id: o.clubBook.id,
                        titulo: o.clubBook.book.title
                    }))
                },
                user.id
            );
        } catch (notifError) {
            console.error('[ERROR] Error al enviar notificaciones (no crítico):', notifError.message);
        }
        return res.json({
            success: true,
            message: `Período "${nombre}" creado exitosamente`,
            periodo: nuevoPeriodo
        });

    } catch (error) {
        console.error('[ERROR] Error al crear período:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

/**
 * Votar por una opción en un período
 * Ruta: POST /api/periodo/:periodoId/votar
 */
const votar = async (req, res) => {
    try {
        const periodoId = parseInt(req.params.periodoId);
        const { opcionId, username } = req.body;
        const user = await prisma.user.findUnique({
            where: { username: username }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        const periodo = await prisma.periodoLectura.findUnique({
            where: { id: periodoId },
            include: {
                club: true
            }
        });

        if (!periodo) {
            return res.status(404).json({
                success: false,
                message: "Período de lectura no encontrado"
            });
        }

        if (periodo.estado !== 'VOTACION') {
            return res.status(400).json({
                success: false,
                message: "Este período no está en votación"
            });
        }

        const esMiembro = await prisma.clubMember.findFirst({
            where: {
                userId: user.id,
                clubId: periodo.clubId
            }
        });

        const esOwner = periodo.club.id_owner === user.id;

        if (!esMiembro && !esOwner) {
            return res.status(403).json({
                success: false,
                message: "No eres miembro de este club"
            });
        }

        const opcion = await prisma.votacionOpcion.findFirst({
            where: {
                id: parseInt(opcionId),
                periodoId: periodoId
            }
        });

        if (!opcion) {
            return res.status(400).json({
                success: false,
                message: "Opción de votación no válida"
            });
        }

        const votoExistente = await prisma.voto.findUnique({
            where: {
                opcionId_userId: {
                    opcionId: parseInt(opcionId),
                    userId: user.id
                }
            }
        });

        if (votoExistente) {
            return res.status(400).json({
                success: false,
                message: "Ya has votado por esta opción"
            });
        }

        const votosPrevios = await prisma.voto.findMany({
            where: {
                userId: user.id,
                opcion: {
                    periodoId: periodoId
                }
            }
        });
        
        const yaHabiaVotado = votosPrevios.length > 0;

        await prisma.voto.deleteMany({
            where: {
                userId: user.id,
                opcion: {
                    periodoId: periodoId
                }
            }
        });

        const nuevoVoto = await prisma.voto.create({
            data: {
                opcionId: parseInt(opcionId),
                userId: user.id
            },
            include: {
                opcion: {
                    include: {
                        clubBook: {
                            include: {
                                book: true
                            }
                        }
                    }
                }
            }
        });

        if (!yaHabiaVotado) {
            await otorgarXP(user.id, 'VOTAR');
        }

        return res.json({
            success: true,
            message: `Voto registrado por "${nuevoVoto.opcion.clubBook.book.title}"`,
            voto: nuevoVoto
        });

    } catch (error) {
        console.error('[ERROR] Error al votar:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

/**
 * Cerrar votación y determinar ganador
 * Ruta: PUT /api/periodo/:periodoId/cerrar-votacion
 */
const cerrarVotacion = async (req, res) => {
    try {
        const periodoId = parseInt(req.params.periodoId);
        const { username } = req.body;
        const user = await prisma.user.findUnique({
            where: { username: username }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        const periodo = await prisma.periodoLectura.findUnique({
            where: { id: periodoId },
            include: {
                club: true,
                opciones: {
                    include: {
                        clubBook: {
                            include: {
                                book: true
                            }
                        },
                        votos: true
                    }
                }
            }
        });

        if (!periodo) {
            return res.status(404).json({
                success: false,
                message: "Período de lectura no encontrado"
            });
        }

        // Verificar permisos
        const clubMember = await prisma.clubMember.findFirst({
            where: {
                userId: user.id,
                clubId: periodo.clubId
            }
        });

        const isOwner = periodo.club.id_owner === user.id;
        const userRole = clubMember ? clubMember.role : (isOwner ? 'OWNER' : null);

        if (userRole !== 'OWNER' && userRole !== 'MODERADOR') {
            return res.status(403).json({
                success: false,
                message: "Solo owners y moderadores pueden cerrar votaciones"
            });
        }

        if (periodo.estado !== 'VOTACION') {
            return res.status(400).json({
                success: false,
                message: "Este período no está en votación"
            });
        }

        const resultados = periodo.opciones.map(opcion => ({
            opcion,
            votos: opcion.votos.length
        })).sort((a, b) => b.votos - a.votos);

        if (resultados.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No hay opciones de votación"
            });
        }

        const maxVotos = resultados[0].votos;
        const empatados = resultados.filter(r => r.votos === maxVotos);
        
        let ganador;
        let esEmpate = false;
        
        if (empatados.length > 1) {
            esEmpate = true;
            const indiceAleatorio = Math.floor(Math.random() * empatados.length);
            ganador = empatados[indiceAleatorio];
        } else {
            ganador = resultados[0];
        }
        const resultado = await prisma.$transaction(async (tx) => {
            // Actualizar período a LEYENDO
            const periodoActualizado = await tx.periodoLectura.update({
                where: { id: periodoId },
                data: {
                    estado: 'LEYENDO',
                    libroGanadorId: ganador.opcion.clubBookId
                }
            });

            // Actualizar estado del libro ganador
            await tx.clubBook.update({
                where: { id: ganador.opcion.clubBookId },
                data: { estado: 'leyendo' }
            });

            return periodoActualizado;
        });

        try {
            await notificarMiembrosClub(
                periodo.clubId,
                'VOTACION_CERRADA',
                'Votación cerrada',
                `La votación "${periodo.nombre}" ha finalizado. El libro ganador es: "${ganador.opcion.clubBook.book.title}"`,
                {
                    periodoId: periodo.id,
                    nombre: periodo.nombre,
                    clubName: periodo.club.name,
                    libroGanador: ganador.opcion.clubBook.book.title,
                    votosGanador: ganador.votos,
                    empate: esEmpate
                },
                user.id
            );
        } catch (notifError) {
            console.error('[ERROR] Error al enviar notificaciones (no crítico):', notifError.message);
        }

        return res.json({
            success: true,
            message: esEmpate ? 
                `Votación cerrada. Hubo empate y "${ganador.opcion.clubBook.book.title}" fue elegido al azar` :
                `Votación cerrada. "${ganador.opcion.clubBook.book.title}" es el libro ganador`,
            ganador: {
                libro: ganador.opcion.clubBook.book,
                votos: ganador.votos
            },
            empate: esEmpate,
            empatados: esEmpate ? empatados.map(e => ({
                libro: e.opcion.clubBook.book.title,
                votos: e.votos
            })) : undefined,
            resultados: resultados.map(r => ({
                libro: r.opcion.clubBook.book.title,
                votos: r.votos
            })),
            periodo: resultado
        });

    } catch (error) {
        console.error('[ERROR] Error al cerrar votación:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

/**
 * Concluir período de lectura
 * Ruta: PUT /api/periodo/:periodoId/concluir-lectura
 */
const concluirLectura = async (req, res) => {
    try {
        const periodoId = parseInt(req.params.periodoId);
        const { username } = req.body;
        const user = await prisma.user.findUnique({
            where: { username: username }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        const periodo = await prisma.periodoLectura.findUnique({
            where: { id: periodoId },
            include: {
                club: true,
                libroGanador: {
                    include: {
                        book: true
                    }
                }
            }
        });

        if (!periodo) {
            return res.status(404).json({
                success: false,
                message: "Período de lectura no encontrado"
            });
        }

        // Verificar permisos
        const clubMember = await prisma.clubMember.findFirst({
            where: {
                userId: user.id,
                clubId: periodo.clubId
            }
        });

        const isOwner = periodo.club.id_owner === user.id;
        const userRole = clubMember ? clubMember.role : (isOwner ? 'OWNER' : null);

        if (userRole !== 'OWNER' && userRole !== 'MODERADOR') {
            return res.status(403).json({
                success: false,
                message: "Solo owners y moderadores pueden concluir períodos"
            });
        }

        if (periodo.estado !== 'LEYENDO') {
            return res.status(400).json({
                success: false,
                message: "Este período no está en lectura"
            });
        }

        const resultado = await prisma.$transaction(async (tx) => {
            const periodoActualizado = await tx.periodoLectura.update({
                where: { id: periodoId },
                data: { estado: 'CERRADO' }
            });

            if (periodo.libroGanadorId) {
                await tx.clubBook.update({
                    where: { id: periodo.libroGanadorId },
                    data: { estado: 'leido' }
                });

                const miembros = await tx.clubMember.findMany({
                    where: { clubId: periodo.clubId },
                    include: { user: true }
                });

                for (const miembro of miembros) {
                    const oldLevel = miembro.user.level || 1;
                    const { xp, level } = computeNewXpAndLevel(miembro.user, XP_PER_BOOK_FINISHED);

                    await tx.user.update({
                        where: { id: miembro.userId },
                        data: { xp, level }
                    });
                    
                    if (level > oldLevel) {
                        crearNotificacion(
                            miembro.userId,
                            'NIVEL_SUBIDO',
                            '🎉 ¡Subiste de nivel!',
                            `¡Felicidades! Ahora eres nivel ${level}. Ganaste ${XP_PER_BOOK_FINISHED} XP por completar la lectura.`,
                            { 
                                oldLevel, 
                                newLevel: level, 
                                xp,
                                xpGanado: XP_PER_BOOK_FINISHED
                            }
                        ).catch(err => console.error('[ERROR] Error al notificar nivel subido:', err));
                    }
                }
            }

            return periodoActualizado;
        });

        return res.json({
            success: true,
            message: `Período "${periodo.nombre}" concluido exitosamente`,
            periodo: resultado,
            libroLeido: periodo.libroGanador?.book
        });

    } catch (error) {
        console.error('[ERROR] Error al concluir lectura:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

/**
 * Obtiene historial de períodos del club
 * Ruta: GET /api/club/:clubId/periodos/historial
 */
const obtenerHistorial = async (req, res) => {
    try {
        const clubId = parseInt(req.params.clubId);

        const historial = await prisma.periodoLectura.findMany({
            where: {
                clubId: clubId,
                estado: 'CERRADO'
            },
            include: {
                libroGanador: {
                    include: {
                        book: true
                    }
                },
                opciones: {
                    include: {
                        clubBook: {
                            include: {
                                book: true
                            }
                        },
                        votos: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const historialProcesado = historial.map(periodo => ({
            ...periodo,
            opciones: periodo.opciones.map(opcion => ({
                ...opcion,
                totalVotos: opcion.votos.length
            })),
            totalVotosEmitidos: periodo.opciones.reduce((sum, op) => sum + op.votos.length, 0)
        }));

        return res.json({
            success: true,
            historial: historialProcesado
        });

    } catch (error) {
        console.error('[ERROR] Error al obtener historial:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

/**
 * Ver qué libros tiene un club (debug)
 * Ruta: GET /api/club/:clubId/libros-debug
 */
const debugLibrosClub = async (req, res) => {
    try {
        const clubId = parseInt(req.params.clubId);
        
        const libros = await prisma.clubBook.findMany({
            where: {
                clubId: clubId
            },
            include: {
                book: true,
                club: true
            }
        });
        
        return res.json({
            success: true,
            clubId: clubId,
            totalLibros: libros.length,
            libros: libros.map(l => ({
                id: l.id,
                titulo: l.book.title,
                autor: l.book.author,
                estado: l.estado,
                club: l.club.name,
                portada: l.book.portada
            }))
        });
        
    } catch (error) {
        console.error('[ERROR] Error en debug libros:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Verifica y cierra automáticamente períodos vencidos
 */
const verificarYCerrarVencimientos = async (clubId) => {
    try {
        const ahora = new Date();
        const votacionesVencidas = await prisma.periodoLectura.findMany({
            where: {
                clubId: clubId,
                estado: 'VOTACION',
                fechaFinVotacion: {
                    lt: ahora
                }
            },
            include: {
                opciones: {
                    include: {
                        clubBook: {
                            include: {
                                book: true
                            }
                        },
                        votos: {
                            include: {
                                user: true
                            }
                        }
                    }
                }
            }
        });

        for (const votacion of votacionesVencidas) {
            await cerrarVotacionAutomatica(votacion);
        }
        const lecturasVencidas = await prisma.periodoLectura.findMany({
            where: {
                clubId: clubId,
                estado: 'LEYENDO',
                fechaFinLectura: {
                    lt: ahora
                }
            },
            include: {
                libroGanador: {
                    include: {
                        book: true
                    }
                }
            }
        });

        for (const lectura of lecturasVencidas) {
            await concluirLecturaAutomatica(lectura);
        }

    } catch (error) {
        console.error('[ERROR] Error al verificar vencimientos:', error);
    }
};

/**
 * Cierra una votación automáticamente
 */
const cerrarVotacionAutomatica = async (periodo) => {
    try {
        const resultados = periodo.opciones.map(opcion => ({
            opcion,
            votos: opcion.votos.length
        })).sort((a, b) => b.votos - a.votos);

        if (resultados.length === 0 || resultados[0].votos === 0) {
            await prisma.periodoLectura.update({
                where: { id: periodo.id },
                data: {
                    estado: 'CERRADO',
                    updatedAt: new Date()
                }
            });

            try {
                await notificarMiembrosClub(
                    periodo.clubId,
                    'VOTACION_CERRADA',
                    'Votación finalizada',
                    `La votación "${periodo.nombre}" ha expirado sin votos suficientes.`,
                    {
                        periodoId: periodo.id,
                        nombre: periodo.nombre
                    },
                    null
                );
            } catch (notifError) {
                console.error('[ERROR] Error al enviar notificaciones:', notifError.message);
            }
            return;
        }

        const ganador = resultados[0];

        await prisma.periodoLectura.update({
            where: { id: periodo.id },
            data: {
                estado: 'LEYENDO',
                libroGanadorId: ganador.opcion.clubBookId,
                updatedAt: new Date()
            }
        });

        await prisma.clubBook.updateMany({
            where: {
                id: ganador.opcion.clubBookId
            },
            data: {
                estado: 'leyendo'
            }
        });

    } catch (error) {
        console.error('[ERROR] Error al cerrar votación automáticamente:', error);
    }
};

/**
 * Concluye una lectura automáticamente
 */
const concluirLecturaAutomatica = async (periodo) => {
    try {
        await prisma.periodoLectura.update({
            where: { id: periodo.id },
            data: {
                estado: 'CERRADO',
                updatedAt: new Date()
            }
        });

        if (periodo.libroGanadorId) {
            await prisma.clubBook.updateMany({
                where: {
                    id: periodo.libroGanadorId
                },
                data: {
                    estado: 'leido'
                }
            });

            try {
                await notificarMiembrosClub(
                    periodo.clubId,
                    'LECTURA_FINALIZADA',
                    'Período de lectura finalizado',
                    `El período de lectura "${periodo.nombre}" ha concluido. ¡Ya puedes comentar sobre el libro!`,
                    {
                        periodoId: periodo.id,
                        nombre: periodo.nombre,
                        libroGanador: periodo.libroGanador?.book?.title
                    },
                    null
                );
            } catch (notifError) {
                console.error('[ERROR] Error al enviar notificaciones:', notifError.message);
            }
        }

    } catch (error) {
        console.error('[ERROR] Error al concluir lectura automáticamente:', error);
    }
};

/**
 * Verificar y notificar votaciones que vencen en menos de 24 horas
 */
const notificarVotacionesPorVencer = async () => {
    try {
        const ahora = new Date();
        const en24Horas = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

        const votacionesPorVencer = await prisma.periodoLectura.findMany({
            where: {
                estado: 'VOTACION',
                fechaFinVotacion: {
                    gte: ahora,
                    lte: en24Horas
                }
            },
            include: {
                club: true,
                opciones: {
                    include: {
                        clubBook: {
                            include: {
                                book: true
                            }
                        }
                    }
                }
            }
        });

        for (const periodo of votacionesPorVencer) {
            const horasRestantes = Math.round((new Date(periodo.fechaFinVotacion) - ahora) / (1000 * 60 * 60));
            const librosNombres = periodo.opciones.map(o => o.clubBook.book.title).join(', ');

            try {
                await notificarMiembrosClub(
                    periodo.clubId,
                    'VOTACION_POR_VENCER',
                    '⏰ Votación termina pronto',
                    `La votación "${periodo.nombre}" cierra en aproximadamente ${horasRestantes} horas. ¡No olvides votar! Libros disponibles: ${librosNombres}`,
                    {
                        periodoId: periodo.id,
                        nombre: periodo.nombre,
                        clubName: periodo.club.name,
                        horasRestantes,
                        fechaFinVotacion: periodo.fechaFinVotacion
                    },
                    null
                );
            } catch (notifError) {
                console.error(`[ERROR] Error al notificar votación por vencer (${periodo.id}):`, notifError.message);
            }
        }

        return { count: votacionesPorVencer.length };
    } catch (error) {
        console.error('[ERROR] Error al verificar votaciones por vencer:', error);
        return { count: 0, error: error.message };
    }
};

module.exports = {
    obtenerEstadoActual,
    crearPeriodo,
    votar,
    cerrarVotacion,
    concluirLectura,
    obtenerHistorial,
    debugLibrosClub,
    notificarVotacionesPorVencer
};