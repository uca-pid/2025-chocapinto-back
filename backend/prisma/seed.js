const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.book.createMany({
    data: [
      { title: "Cien años de soledad", author: "Gabriel García Márquez" },
      { title: "Don Quijote de la Mancha", author: "Miguel de Cervantes Saavedra" },
      { title: "La sombra del viento", author: "Carlos Ruiz Zafón" },
      { title: "Rayuela", author: "Julio Cortázar" },
      { title: "Ficciones", author: "Jorge Luis Borges" },
      { title: "Como agua para chocolate", author: "Laura Esquivel" }
    ],
  });
}

main()
  .then(() => {
    console.log("Seed data inserted");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
