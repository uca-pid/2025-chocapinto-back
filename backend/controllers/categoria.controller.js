const prisma = require('../db');
const { validateRequiredFields } = require('../utils/validateFields');

const CATEGORIAS_ESTATICAS = ["Ficción", "No Ficción", "Ciencia Ficción", "Fantasía", "Ensayo"];

/**
 * Obtiene todas las categorías disponibles
 * Ruta: GET /api/categorias
 */
const getCategorias = async (req, res) => {
  try {
    for (const nombre of CATEGORIAS_ESTATICAS) {
      await prisma.categoria.upsert({
        where: { nombre },
        update: {},
        create: { nombre }
      });
    }
    
    const categorias = await prisma.categoria.findMany({
      orderBy: { nombre: 'asc' }
    });
    res.json({ success: true, categorias });
  } catch (error) {
    console.error("[ERROR] Error al obtener categorías:", error);
    res.status(500).json({ success: false, message: "Error al obtener categorías" });
  }
};

/**
 * Crea una nueva categoría
 * Ruta: POST /api/categorias
 */
const createCategoria = async (req, res) => {
  try {
    const { nombre } = req.body;

    const missingFields = validateRequiredFields(['nombre'], req.body);
    if (missingFields) {
      return res.status(400).json({ success: false, message: "Nombre de categoría requerido" });
    }

    const existingCategoria = await prisma.categoria.findFirst({
      where: { 
        nombre: {
          equals: nombre.trim()
        }
      }
    });

    if (existingCategoria) {
      return res.status(400).json({ success: false, message: "La categoría ya existe" });
    }

    const categoria = await prisma.categoria.create({
      data: { nombre: nombre.trim() }
    });

    res.json({ success: true, categoria });
  } catch (error) {
    console.error("[ERROR] Error al crear categoría:", error);
    res.status(500).json({ success: false, message: "Error al crear categoría" });
  }
};

/**
 * Actualiza una categoría existente
 * Ruta: PUT /api/categorias/:id
 */
const updateCategoria = async (req, res) => {
  try {
    const categoriaId = Number(req.params.id);
    const { nombre } = req.body;

    if (!categoriaId || !nombre) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }

    const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } });
    if (!categoria) {
      return res.status(404).json({ success: false, message: "Categoría no encontrada" });
    }

    if (CATEGORIAS_ESTATICAS.includes(categoria.nombre)) {
      return res.status(403).json({ success: false, message: "No se puede editar esta categoría predeterminada" });
    }

    const updated = await prisma.categoria.update({
      where: { id: categoriaId },
      data: { nombre: nombre.trim() }
    });
    res.json({ success: true, categoria: updated });
  } catch (error) {
    console.error("[ERROR] Error al editar categoría:", error);
    res.status(500).json({ success: false, message: "Error al editar categoría" });
  }
};

/**
 * Elimina una categoría
 * Ruta: DELETE /api/categorias/:id
 */
const deleteCategoria = async (req, res) => {
  try {
    const categoriaId = Number(req.params.id);
    if (!categoriaId) {
      return res.status(400).json({ success: false, message: "ID inválido" });
    }

    const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } });
    if (!categoria) {
      return res.status(404).json({ success: false, message: "Categoría no encontrada" });
    }

    if (CATEGORIAS_ESTATICAS.includes(categoria.nombre)) {
      return res.status(403).json({ success: false, message: "No se puede eliminar esta categoría predeterminada" });
    }

    const booksUsingCategory = await prisma.book.findMany({
      where: {
        categorias: {
          some: { id: categoriaId }
        }
      }
    });

    if (booksUsingCategory.length > 0) {
      for (const book of booksUsingCategory) {
        await prisma.book.update({
          where: { id: book.id },
          data: {
            categorias: {
              disconnect: { id: categoriaId }
            }
          }
        });
      }
    }

    await prisma.categoria.delete({ where: { id: categoriaId } });
    
    const message = booksUsingCategory.length > 0 
      ? `Categoría eliminada y desconectada de ${booksUsingCategory.length} libros`
      : "Categoría eliminada";
    
    res.json({ success: true, message });
  } catch (error) {
    console.error("[ERROR] Error al eliminar categoría:", error);
    res.status(500).json({ success: false, message: "Error al eliminar categoría" });
  }
};

module.exports = {
  getCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria
};