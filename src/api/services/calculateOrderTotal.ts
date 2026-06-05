import { prisma } from "../../../lib/prismaClient.js";

export class ProductNotFoundError extends Error {
  constructor(public readonly productIds: string[]) {
    super(`Products not found: ${productIds.join(", ")}`);
    this.name = "ProductNotFoundError";
  }
}

export const calculateOrderTotal = async (productIds: string[]): Promise<number> => {
  const uniqueIds = [...new Set(productIds)];
  const products = await prisma.product.findMany({
    where: { id: { in: uniqueIds } },
  });

  const priceById = new Map(products.map((product) => [product.id, product.price]));
  const missingIds = uniqueIds.filter((id) => !priceById.has(id));

  if (missingIds.length > 0) {
    throw new ProductNotFoundError(missingIds);
  }

  return productIds.reduce((total, id) => total + priceById.get(id)!, 0);
};
