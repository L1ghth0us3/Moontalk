// Intentional TypeScript error to fail build
export const shouldBeNumber: number = "oops" as unknown as number & string;

