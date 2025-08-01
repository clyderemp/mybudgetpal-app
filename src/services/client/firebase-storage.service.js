import { useFirebaseConfig } from "@/configs/firebase.config";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

const { storage } = useFirebaseConfig;

class FirebaseStorage {
  /**
   * Uploads a file to Firebase Storage at the given path
   * @param {string} path - The storage path (e.g. "authors/image.jpg")
   * @param {File|Blob} file - The file to upload
   * @returns {Promise<{ success: boolean, url?: string, error?: any }>}
   */
  async uploadFile(path, file) {
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return { success: true, url };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * Deletes a file from Firebase Storage at the given path
   * @param {string} path - The storage path (e.g. "authors/image.jpg")
   * @returns {Promise<{ success: boolean, error?: any }>}
   */
  async deleteFile(path) {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }
}

export const useFirebaseStorage = new FirebaseStorage();
