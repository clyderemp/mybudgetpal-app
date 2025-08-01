const generateUid = (type) => {
  if (typeof type !== "string" || !type.trim()) {
    throw new Error("Type must be a non-empty string");
  }

  const randomPart = Math.random().toString(36).slice(2, 10).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();

  return `${type.toUpperCase()}-${timestamp}-${randomPart}`;
};

export const useGeneratorUtils = {
  generateUid,
};
