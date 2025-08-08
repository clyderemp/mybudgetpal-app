import CryptoJS from "crypto-js";

/**
 * Generates 100 unique keys by hashing the input + index
 * @param {string} input - the base passphrase
 * @returns {Promise<string[]>} - array of 100 SHA256 hex strings
 */
const generateKeys = async (input) => {
  const keys = [];
  for (let i = 0; i < 100; i++) {
    const combined = `${input}-${i}`;
    const hash = CryptoJS.SHA256(combined).toString();
    keys.push(hash);
  }
  return keys;
};

/**
 * Encrypts data using 100 AES keys derived from the input key.
 * If stringify is true, forces JSON.stringify even on string inputs.
 * @param {string} inputKey - master key
 * @param {any} data - data to encrypt
 * @param {boolean} stringify - if true, always stringify data before encrypting
 * @returns {Promise<string>} - JSON stringified encrypted chunks
 */
const encryptData = async (inputKey, data, stringify = false) => {
  const keys = await generateKeys(inputKey);

  // Force stringify if flag is true, even if data is already a string
  const plainText =
    stringify || typeof data !== "string" ? JSON.stringify(data) : data;

  const chunkSize = Math.ceil(plainText.length / 100);
  const chunks = plainText.match(new RegExp(`.{1,${chunkSize}}`, "g")) || [];

  const encryptedChunks = chunks.map((chunk, idx) => {
    const encrypted = CryptoJS.AES.encrypt(chunk, keys[idx]).toString();
    return encrypted;
  });

  return JSON.stringify(encryptedChunks);
};

/**
 * Decrypts the encrypted string using the same 100 AES keys.
 * Automatically detects the original type if JSON-parseable (object, array, number, boolean).
 * If not, returns raw string.
 * @param {string} inputKey - master key
 * @param {string} encryptedString - JSON stringified encrypted chunks
 * @param {boolean} stringify - if true, always return parsed value (even for raw strings)
 * @returns {Promise<any>}
 */
const decryptData = async (inputKey, encryptedString, stringify = false) => {
  const keys = await generateKeys(inputKey);

  let encryptedChunks;
  try {
    encryptedChunks = JSON.parse(encryptedString);
  } catch (err) {
    throw new Error("Invalid encrypted data format");
  }

  const decryptedChunks = encryptedChunks.map((chunk, idx) => {
    const bytes = CryptoJS.AES.decrypt(chunk, keys[idx]);
    return bytes.toString(CryptoJS.enc.Utf8);
  });

  const decryptedText = decryptedChunks.join("");

  // Always try to parse — even if stringify = false — to detect original type
  try {
    return JSON.parse(decryptedText);
  } catch {
    // If parsing fails and stringify is explicitly true, return as-is string
    return stringify ? decryptedText : decryptedText;
  }
};

export const useEncryptionUtils = {
  generateKeys,
  encryptData,
  decryptData,
};
