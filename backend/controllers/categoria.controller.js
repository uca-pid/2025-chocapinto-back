// controllers/categoria.controller.js - CORREGIR la función createCategoria
const prisma = require('../db');
const { validateRequiredFields } = require('../utils/validateFields');

const createCategoria = async (req, res) => {
  try {
    const { nombre } = req.body;

    const missingFields = validateRequiredFields(['nombre'], req.body);
    if (missingFields) {
      return res.status(400).json({ success: false, message: "Nombre de categoría requerido" });
    }

    // CORREGIR: Usar contains en lugar de equals con mode
    const existingCategoria = await prisma.categoria.findFirst({
      where: { 
        nombre: {
          equals: nombre.trim() // Sin mode: "insensitive"
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
    console.error("Error al crear categoría:", error);
    res.status(500).json({ success: false, message: "Error al crear categoría" });
  }
};

// Resto de funciones...
const getCategorias = async (req, res) => {
  try {
    // Insertar categorías por defecto si no existen
    const categoriasEstaticas = [
      "Ficción",
      "No Ficción", 
      "Ciencia Ficción",
      "Fantasía",
      "Ensayo"
    ];

    for (const nombre of categoriasEstaticas) {
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
    console.error("Error al obtener categorías:", error);
    res.status(500).json({ success: false, message: "Error al obtener categorías" });
  }
};

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

    // Categorías que no se pueden editar
    const categoriasEstaticas = ["Ficción", "No Ficción", "Ciencia Ficción", "Fantasía", "Ensayo"];
    if (categoriasEstaticas.includes(categoria.nombre)) {
      return res.status(403).json({ success: false, message: "No se puede editar esta categoría predeterminada" });
    }

    const updated = await prisma.categoria.update({
      where: { id: categoriaId },
      data: { nombre: nombre.trim() }
    });
    res.json({ success: true, categoria: updated });
  } catch (error) {
    console.error("Error al editar categoría:", error);
    res.status(500).json({ success: false, message: "Error al editar categoría" });
  }
};

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

    // Categorías que no se pueden eliminar
    const categoriasEstaticas = ["Ficción", "No Ficción", "Ciencia Ficción", "Fantasía", "Ensayo"];
    if (categoriasEstaticas.includes(categoria.nombre)) {
      return res.status(403).json({ success: false, message: "No se puede eliminar esta categoría predeterminada" });
    }

    // Verificar si está en uso y desconectar de todos los libros
    const booksUsingCategory = await prisma.book.findMany({
      where: {
        categorias: {
          some: { id: categoriaId }
        }
      }
    });

    if (booksUsingCategory.length > 0) {
      console.log(`Desconectando categoría "${categoria.nombre}" de ${booksUsingCategory.length} libros`);
      
      // Desconectar la categoría de todos los libros que la usan
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

    // Ahora eliminar la categoría
    await prisma.categoria.delete({ where: { id: categoriaId } });
    
    const message = booksUsingCategory.length > 0 
      ? `Categoría eliminada y desconectada de ${booksUsingCategory.length} libros`
      : "Categoría eliminada";
    
    res.json({ success: true, message });
  } catch (error) {
    console.error("Error al eliminar categoría:", error);
    res.status(500).json({ success: false, message: "Error al eliminar categoría" });
  }
};

module.exports = {
  getCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria
};