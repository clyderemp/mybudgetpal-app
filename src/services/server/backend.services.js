import { backendApi } from "@/configs/servers.config";

class BackendServices {
  // Create document in collection
  async create(collection, data = {}) {
    const response = await backendApi.post(
      `/api/mongo/set/${collection}`,
      data
    );
    return response?.data;
  }

  // Get document by ID
  async get(collection, docId) {
    if (!docId) throw new Error("docId is required for get");
    const response = await backendApi.get(
      `/api/mongo/fetch/${collection}/${docId}`
    );
    return response?.data;
  }

  // Get all documents in collection
  async getAll(collection, params = {}) {
    const response = await backendApi.get(`/api/mongo/fetchAll/${collection}`, {
      params,
    });
    return response.data;
  }

  // Update document by ID
  async update(collection, docId, data = {}) {
    if (!docId) throw new Error("docId is required for update");
    const response = await backendApi.put(
      `/api/mongo/update/${collection}/${docId}`,
      data
    );
    return response.status === 200;
  }

  // Update all documents in collection
  async updateAll(collection, data = {}) {
    const response = await backendApi.put(
      `/api/mongo/updateAll/${collection}`,
      data
    );
    return response.data;
  }

  // Delete document by ID
  async delete(collection, docId) {
    if (!docId) throw new Error("docId is required for delete");
    const response = await backendApi.delete(
      `/api/mongo/delete/${collection}/${docId}`
    );
    return response.data;
  }

  // Delete all documents in collection
  async deleteAll(collection) {
    const response = await backendApi.delete(
      `/api/mongo/deleteAll/${collection}`
    );
    return response.data;
  }
}

export const useBackendServices = new BackendServices();
