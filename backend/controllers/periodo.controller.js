const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { computeNewXpAndLevel, XP_PER_BOOK_FINISHED } = require('../utils/xpSystem');

// ========== ENDPOINT A: ESTADO ACTUAL DEL CLUB ==========

/**
 * Obtiene el estado actual del club (el más importante)
 * GET /api/club/:clubId/estado-actual
 */
const obtenerEstadoActual = async (req, res) => {
    try {
        const clubId = parseInt(req.params.clubId);

        console.log(`🔍 Consultando estado actual del club ${clubId}`);

        // ⏰ VERIFICACIÓN AUTOMÁTICA DE VENCIMIENTOS
        await verificarYCerrarVencimientos(clubId);

        // 1. Buscar período en VOTACION
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
            console.log(`🗳️ Club en estado VOTACION - Período: ${periodoActivo.nombre}`);
            
            // Calcular votos por opción
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

        // 2. Buscar período en LEYENDO
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
            console.log(`📚 Club en estado LEYENDO - Libro: ${periodoActivo.libroGanador?.book?.title}`);
            
            return res.json({
                success: true,
                estado: 'LEYENDO',
                periodo: periodoActivo
            });
        }

        // 3. No hay período activo
        console.log(`😴 Club inactivo - No hay período de lectura`);
        return res.json({
            success: true,
            estado: 'INACTIVO',
            periodo: null
        });

    } catch (error) {
        console.error('❌ Error al obtener estado actual:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// ========== ENDPOINT B: CREAR VOTACIÓN ==========

/**
 * Crear nuevo período de lectura con votación
 * POST /api/club/:clubId/periodos
 */
const crearPeriodo = async (req, res) => {
    try {
        const clubId = parseInt(req.params.clubId);
        const { nombre, fechaFinVotacion, fechaFinLectura, clubBookIds, username } = req.body;

        console.log(`🆕 Creando período de lectura en club ${clubId}:`, { 
            nombre, 
            libros: clubBookIds?.length,
            clubBookIds: clubBookIds,
            createdBy: username 
        });

        // Debug: Verificar club
        const club = await prisma.club.findUnique({
            where: { id: clubId }
        });
        
        if (!club) {
            return res.status(404).json({
                success: false,
                message: `Club con ID ${clubId} no encontrado`
            });
        }
        
        console.log(`🏠 Club encontrado: ${club.name}`);

        // 1. Verificar permisos del usuario
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

        

        // 2. Verificar que no haya período activo
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

        // 3. Validar fechas
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

        // 4. Verificar que los libros existan y estén "por leer"
        console.log(`🔍 Verificando libros: ${clubBookIds} en club ${clubId}`);
        
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

        console.log(`📚 Libros encontrados: ${librosDisponibles.length} de ${clubBookIds.length}`);
        console.log('Libros disponibles:', librosDisponibles.map(l => `ID:${l.id} - ${l.book.title}`));

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

        // 5. Crear el período con sus opciones
        console.log(`📝 Creando período con datos:`, {
            clubId: clubId,
            nombre: nombre,
            fechaFinVotacion: fechaVotacion,
            fechaFinLectura: fechaLectura,
            opciones: clubBookIds.map(id => ({ clubBookId: parseInt(id) }))
        });
        
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

        console.log(`✅ Período creado exitosamente: ${nuevoPeriodo.id}`);

        return res.json({
            success: true,
            message: `Período "${nombre}" creado exitosamente`,
            periodo: nuevoPeriodo
        });

    } catch (error) {
        console.error('❌ Error al crear período:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// ========== ENDPOINT C: VOTAR ==========

/**
 * Votar por una opción en un período
 * POST /api/periodo/:periodoId/votar
 */
const votar = async (req, res) => {
    try {
        const periodoId = parseInt(req.params.periodoId);
        const { opcionId, username } = req.body;

        console.log(`🗳️ Procesando voto en período ${periodoId}:`, { opcionId, username });

        // 1. Verificar usuario
        const user = await prisma.user.findUnique({
            where: { username: username }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        // 2. Verificar que el período esté en VOTACION
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

        // 3. Verificar que el usuario sea miembro del club
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

        // 4. Verificar que la opción pertenezca a este período
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

        // 5. Verificar que no haya votado ya por esta opción
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

        // 6. Eliminar cualquier voto previo del usuario en este período
        await prisma.voto.deleteMany({
            where: {
                userId: user.id,
                opcion: {
                    periodoId: periodoId
                }
            }
        });

        // 7. Registrar el nuevo voto
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

        console.log(`✅ Voto registrado: ${user.username} → ${nuevoVoto.opcion.clubBook.book.title}`);

        return res.json({
            success: true,
            message: `Voto registrado por "${nuevoVoto.opcion.clubBook.book.title}"`,
            voto: nuevoVoto
        });

    } catch (error) {
        console.error('❌ Error al votar:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// ========== ENDPOINT D: CERRAR VOTACIÓN ==========

/**
 * Cerrar votación y determinar ganador
 * PUT /api/periodo/:periodoId/cerrar-votacion
 */
const cerrarVotacion = async (req, res) => {
    try {
        const periodoId = parseInt(req.params.periodoId);
        const { username } = req.body;

        console.log(`🏁 Cerrando votación del período ${periodoId} por ${username}`);

        // 1. Verificar usuario y permisos
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

        // 2. Contar votos y determinar ganador
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

        // Verificar si hay empate y manejar selección aleatoria
        const maxVotos = resultados[0].votos;
        const empatados = resultados.filter(r => r.votos === maxVotos);
        
        let ganador;
        let esEmpate = false;
        
        if (empatados.length > 1) {
            // HAY EMPATE - Elegir ganador al azar
            esEmpate = true;
            const indiceAleatorio = Math.floor(Math.random() * empatados.length);
            ganador = empatados[indiceAleatorio];
            
            console.log(`🎲 EMPATE detectado entre ${empatados.length} libros con ${maxVotos} votos:`);
            empatados.forEach((emp, i) => {
                const marca = i === indiceAleatorio ? '🏆 GANADOR AL AZAR' : '❌';
                console.log(`   ${marca} ${emp.opcion.clubBook.book.title} - ${emp.votos} votos`);
            });
        } else {
            // Ganador claro
            ganador = resultados[0];
            console.log(`🏆 Ganador claro: ${ganador.opcion.clubBook.book.title} con ${ganador.votos} votos`);
        }

        // 3. Actualizar período y libro ganador en transacción
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

        const mensajeResultado = esEmpate ? 
            `🎲 Votación cerrada con EMPATE - Ganador aleatorio: ${ganador.opcion.clubBook.book.title} (${ganador.votos} votos)` :
            `🏆 Votación cerrada - Ganador: ${ganador.opcion.clubBook.book.title} con ${ganador.votos} votos`;

        console.log(mensajeResultado);

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
        console.error('❌ Error al cerrar votación:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// ========== ENDPOINT E: CONCLUIR LECTURA ==========

/**
 * Concluir período de lectura
 * PUT /api/periodo/:periodoId/concluir-lectura
 */
const concluirLectura = async (req, res) => {
    try {
        const periodoId = parseInt(req.params.periodoId);
        const { username } = req.body;

        console.log(`📖 Concluyendo lectura del período ${periodoId} por ${username}`);

        // 1. Verificar usuario y permisos
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

        // 2. Actualizar período y libro en transacción
        const resultado = await prisma.$transaction(async (tx) => {
            // Actualizar período a CERRADO
            const periodoActualizado = await tx.periodoLectura.update({
                where: { id: periodoId },
                data: { estado: 'CERRADO' }
            });

            // Actualizar estado del libro a leído
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
                    const { xp, level } = computeNewXpAndLevel(miembro.user, XP_PER_BOOK_FINISHED);

                    await tx.user.update({
                        where: { id: miembro.userId },
                        data: { xp, level }
                    });
                    console.log('XP actualizada - userId=${miembro.userId} xp=${xp} level=${level}');
                }
            }
            

            return periodoActualizado;
        });

        console.log(`✅ Período de lectura concluido: ${periodo.nombre}`);

        return res.json({
            success: true,
            message: `Período "${periodo.nombre}" concluido exitosamente`,
            periodo: resultado,
            libroLeido: periodo.libroGanador?.book
        });

    } catch (error) {
        console.error('❌ Error al concluir lectura:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// ========== ENDPOINT EXTRA: HISTORIAL DE PERÍODOS ==========

/**
 * Obtener historial de períodos del club
 * GET /api/club/:clubId/periodos/historial
 */
const obtenerHistorial = async (req, res) => {
    try {
        const clubId = parseInt(req.params.clubId);

        console.log(`📚 Obteniendo historial de períodos del club ${clubId}`);

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

        // Procesar datos para el frontend
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
        console.error('❌ Error al obtener historial:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// ========== ENDPOINT DEBUG: LISTAR LIBROS DEL CLUB ==========

/**
 * Debugging: Ver qué libros tiene un club
 * GET /api/club/:clubId/libros-debug
 */
const debugLibrosClub = async (req, res) => {
    try {
        const clubId = parseInt(req.params.clubId);
        
        console.log(`🐞 DEBUG: Listando libros del club ${clubId}`);
        
        const libros = await prisma.clubBook.findMany({
            where: {
                clubId: clubId
            },
            include: {
                book: true,
                club: true
            }
        });
        
        console.log(`📚 Libros encontrados: ${libros.length}`);
        
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
        console.error('❌ Error en debug libros:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ========== FUNCIÓN AUXILIAR: VERIFICAR VENCIMIENTOS ==========

/**
 * Verifica y cierra automáticamente períodos vencidos
 * @param {number} clubId - ID del club
 */
const verificarYCerrarVencimientos = async (clubId) => {
    try {
        const ahora = new Date();
        console.log(`⏰ Verificando vencimientos para club ${clubId} - ${ahora.toISOString()}`);

        // 1. Verificar votaciones vencidas
        const votacionesVencidas = await prisma.periodoLectura.findMany({
            where: {
                clubId: clubId,
                estado: 'VOTACION',
                fechaFinVotacion: {
                    lt: ahora // menor que la fecha actual
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

        // Cerrar votaciones vencidas automáticamente
        for (const votacion of votacionesVencidas) {
            console.log(`🗳️ AUTO-CERRANDO votación vencida: ${votacion.nombre}`);
            await cerrarVotacionAutomatica(votacion);
        }

        // 2. Verificar lecturas vencidas
        const lecturasVencidas = await prisma.periodoLectura.findMany({
            where: {
                clubId: clubId,
                estado: 'LEYENDO',
                fechaFinLectura: {
                    lt: ahora // menor que la fecha actual
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

        // Concluir lecturas vencidas automáticamente
        for (const lectura of lecturasVencidas) {
            console.log(`📚 AUTO-CONCLUYENDO lectura vencida: ${lectura.nombre}`);
            await concluirLecturaAutomatica(lectura);
        }

        if (votacionesVencidas.length === 0 && lecturasVencidas.length === 0) {
            console.log(`✅ No hay períodos vencidos para club ${clubId}`);
        }

    } catch (error) {
        console.error('❌ Error al verificar vencimientos:', error);
    }
};

/**
 * Cierra una votación automáticamente (lógica similar a cerrarVotacion pero sin req/res)
 */
const cerrarVotacionAutomatica = async (periodo) => {
    try {
        console.log(`🤖 CERRANDO AUTOMÁTICAMENTE votación: ${periodo.nombre}`);

        // Contar votos por opción
        const resultados = periodo.opciones.map(opcion => ({
            opcion,
            votos: opcion.votos.length
        })).sort((a, b) => b.votos - a.votos);

        if (resultados.length === 0 || resultados[0].votos === 0) {
            // Sin votos - marcar como cerrado sin ganador
            await prisma.periodoLectura.update({
                where: { id: periodo.id },
                data: {
                    estado: 'CERRADO',
                    updatedAt: new Date()
                }
            });
            console.log(`⚠️ Votación cerrada automáticamente SIN VOTOS: ${periodo.nombre}`);
            return;
        }

        // Determinar ganador
        const ganador = resultados[0];
        const esEmpate = resultados.length > 1 && resultados[1].votos === ganador.votos;

        if (esEmpate) {
            // En caso de empate, tomar el primero (o implementar lógica de desempate)
            console.log(`⚖️ EMPATE detectado, tomando primera opción: ${ganador.opcion.clubBook.book.title}`);
        }

        // Actualizar el período con el libro ganador
        await prisma.periodoLectura.update({
            where: { id: periodo.id },
            data: {
                estado: 'LEYENDO',
                libroGanadorId: ganador.opcion.clubBookId,
                updatedAt: new Date()
            }
        });

        // Actualizar estado del libro ganador a "leyendo" para todos los miembros
        await prisma.clubBook.updateMany({
            where: {
                id: ganador.opcion.clubBookId
            },
            data: {
                estado: 'leyendo'
            }
        });

        console.log(`✅ Votación cerrada automáticamente - Ganador: ${ganador.opcion.clubBook.book.title}`);

    } catch (error) {
        console.error('❌ Error al cerrar votación automáticamente:', error);
    }
};

/**
 * Concluye una lectura automáticamente (lógica similar a concluirLectura pero sin req/res)
 */
const concluirLecturaAutomatica = async (periodo) => {
    try {
        console.log(`🤖 CONCLUYENDO AUTOMÁTICAMENTE lectura: ${periodo.nombre}`);

        // Actualizar el período a CERRADO
        await prisma.periodoLectura.update({
            where: { id: periodo.id },
            data: {
                estado: 'CERRADO',
                updatedAt: new Date()
            }
        });

        // Actualizar estado del libro a "leido" para todos los miembros del club
        if (periodo.libroGanadorId) {
            await prisma.clubBook.updateMany({
                where: {
                    id: periodo.libroGanadorId
                },
                data: {
                    estado: 'leido'
                }
            });

            console.log(`✅ Lectura concluida automáticamente - Libro: ${periodo.libroGanador?.book?.title}`);
        }

    } catch (error) {
        console.error('❌ Error al concluir lectura automáticamente:', error);
    }
};

module.exports = {
    obtenerEstadoActual,
    crearPeriodo,
    votar,
    cerrarVotacion,
    concluirLectura,
    obtenerHistorial,
    debugLibrosClub
};