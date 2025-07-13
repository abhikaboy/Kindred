import { useEffect, useState } from "react";
import axios from "axios";
import { useSafeAsync } from "../hooks/useSafeAsync";

export interface CreateBlueprintRequest {
  banner: string;
  name: string;
  tags: string[];
  description: string;
  duration: string;
}

export interface UpdateBlueprintRequest {
  banner?: string;
  name?: string;
  tags?: string[];
  description?: string;
  duration?: string;
}

export interface BlueprintResponse {
  id?: string;
  _id?: {
    $oid: string;
  };
  banner: string;
  name: string;
  tags: string[];
  description: string;
  duration: string;
  subscribers: string[];
  subscribersCount: number | { $numberLong: string };
  timestamp: string | { $date: string };
  owner: {
    _id?: {
      $oid: string;
    };
    id?: string;
    display_name?: string;
    displayName?: string;
    handle: string;
    profile_picture?: string;
    profilePicture?: string;
  };
}

export interface ApiResponse<T> {
  body: T;
}

export interface MessageResponse {
  message: string;
}


const normalizeBlueprint = (blueprint: any): BlueprintResponse => {
  return {
    id: blueprint.id || blueprint._id?.$oid || blueprint._id,
    banner: blueprint.banner || "",
    name: blueprint.name || "",
    tags: blueprint.tags || [],
    description: blueprint.description || "",
    duration: blueprint.duration || "",
    subscribers: blueprint.subscribers || [],
    subscribersCount: typeof blueprint.subscribersCount === 'object' 
      ? parseInt(blueprint.subscribersCount.$numberLong || '0', 10)
      : blueprint.subscribersCount || 0,
    timestamp: typeof blueprint.timestamp === 'object'
      ? blueprint.timestamp.$date
      : blueprint.timestamp || new Date().toISOString(),
    owner: {
      id: blueprint.owner?.id || blueprint.owner?._id?.$oid || blueprint.owner?._id,
      displayName: blueprint.owner?.displayName || blueprint.owner?.display_name || "",
      handle: blueprint.owner?.handle || "",
      profilePicture: blueprint.owner?.profilePicture || blueprint.owner?.profile_picture || "",
    },
  };
};

export function useBlueprints() {
  const [blueprints, setBlueprints] = useState<BlueprintResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const safeAsync = useSafeAsync();

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  useEffect(() => {
    const loadBlueprints = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      const { result, error } = await safeAsync(async () => {
        console.log("Fetching blueprints from:", `${API_URL}/blueprints`);
        const response = await axios.get(`${API_URL}/blueprints`);
        
        console.log("Response status:", response.status);
        console.log("Response data:", response.data);
        
        if (response.status > 300) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.data; 
      });

      if (error) {
        console.error("Error loading blueprints:", error);
        setError(error.message || "Failed to load blueprints");
      } else {
        console.log("Raw blueprints response:", result);
        const normalizedBlueprints = (result || []).map(normalizeBlueprint);
        console.log("Normalized blueprints:", normalizedBlueprints);
        setBlueprints(normalizedBlueprints);
      }

      setLoading(false);
    };

    loadBlueprints();
  }, []);

  // Create a new blueprint
  const createBlueprint = async (data: CreateBlueprintRequest): Promise<BlueprintResponse | null> => {
    setError(null);
    
    console.log("Creating blueprint with data:", data);
    console.log("API URL:", `${API_URL}/user/blueprints`);
    console.log("Axios headers:", axios.defaults.headers.common);

    const { result, error } = await safeAsync(async () => {
      const response = await axios.post(`${API_URL}/user/blueprints`, data);
      
      console.log("Create response status:", response.status);
      console.log("Create response data:", response.data);
      
      if (response.status > 300) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.data; 
    });

    if (error) {
      console.error("Error creating blueprint:", error);
      setError(error.message || "Failed to create blueprint");
      return null;
    }

    if (result) {
      const normalizedBlueprint = normalizeBlueprint(result);
      setBlueprints(prev => [normalizedBlueprint, ...prev]);
      return normalizedBlueprint;
    }

    return null;
  };

  // Get blueprint by ID
  const getBlueprintById = async (id: string): Promise<BlueprintResponse | null> => {
    setError(null);

    const { result, error } = await safeAsync(async () => {
      const response = await axios.get(`${API_URL}/blueprints/${id}`);
      
      if (response.status > 300) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.data;
    });

    if (error) {
      console.error("Error getting blueprint:", error);
      setError(error.message || "Failed to get blueprint");
      return null;
    }

    return result ? normalizeBlueprint(result) : null;
  };

  // Update blueprint
  const updateBlueprint = async (id: string, data: UpdateBlueprintRequest): Promise<boolean> => {
    setError(null);

    const { result, error } = await safeAsync(async () => {
      const response = await axios.patch(`${API_URL}/user/blueprints/${id}`, data);
      
      if (response.status > 300) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.data;
    });

    if (error) {
      console.error("Error updating blueprint:", error);
      setError(error.message || "Failed to update blueprint");
      return false;
    }

    const refreshedBlueprints = await refreshBlueprints();
    if (refreshedBlueprints) {
      setBlueprints(refreshedBlueprints);
    }

    return true;
  };

  // Delete blueprint
  const deleteBlueprint = async (id: string): Promise<boolean> => {
    setError(null);

    const { result, error } = await safeAsync(async () => {
      const response = await axios.delete(`${API_URL}/user/blueprints/${id}`);
      
      if (response.status > 300) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.data;
    });

    if (error) {
      console.error("Error deleting blueprint:", error);
      setError(error.message || "Failed to delete blueprint");
      return false;
    }
    setBlueprints(prev => prev.filter(bp => bp.id !== id));
    return true;
  };

  // Subscribe to blueprint
  const subscribeToBlueprint = async (id: string): Promise<boolean> => {
    setError(null);

    const { result, error } = await safeAsync(async () => {
      const response = await axios.patch(`${API_URL}/user/blueprints/${id}/subscribe`);
      
      if (response.status > 300) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.data;
    });

    if (error) {
      console.error("Error subscribing to blueprint:", error);
      setError(error.message || "Failed to subscribe to blueprint");
      return false;
    }

    // Refresh blueprints to get updated subscriber count
    const refreshedBlueprints = await refreshBlueprints();
    if (refreshedBlueprints) {
      const normalizedBlueprints = refreshedBlueprints.map(normalizeBlueprint);
      setBlueprints(normalizedBlueprints);
    }

    return true;
  };

  // Unsubscribe from blueprint
  const unsubscribeFromBlueprint = async (id: string): Promise<boolean> => {
    setError(null);

    const { result, error } = await safeAsync(async () => {
      const response = await axios.patch(`${API_URL}/user/blueprints/${id}/unsubscribe`);
      
      if (response.status > 300) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.data;
    });

    if (error) {
      console.error("Error unsubscribing from blueprint:", error);
      setError(error.message || "Failed to unsubscribe from blueprint");
      return false;
    }

    // Refresh blueprints to get updated subscriber count
    const refreshedBlueprints = await refreshBlueprints();
    if (refreshedBlueprints) {
      const normalizedBlueprints = refreshedBlueprints.map(normalizeBlueprint);
      setBlueprints(normalizedBlueprints);
    }

    return true;
  };

  // Search blueprints
  const searchBlueprints = async (query: string): Promise<BlueprintResponse[]> => {
    setError(null);

    const { result, error } = await safeAsync(async () => {
      const response = await axios.get(`${API_URL}/blueprints/search?query=${encodeURIComponent(query)}`);
      
      if (response.status > 300) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.data;
    });

    if (error) {
      console.error("Error searching blueprints:", error);
      setError(error.message || "Failed to search blueprints");
      return [];
    }

    return (result || []).map(normalizeBlueprint);
  };

  // Refresh blueprints
  const refreshBlueprints = async (): Promise<BlueprintResponse[] | null> => {
    const { result, error } = await safeAsync(async () => {
      const response = await axios.get(`${API_URL}/blueprints`);
      
      if (response.status > 300) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.data;
    });

    if (error) {
      console.error("Error refreshing blueprints:", error);
      return null;
    }

    return result || [];
  };

  // Manual refresh function
  const refresh = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    const refreshedBlueprints = await refreshBlueprints();
    if (refreshedBlueprints) {
      setBlueprints(refreshedBlueprints);
    }

    setLoading(false);
  };

  return {
    blueprints,
    loading,
    error,
    createBlueprint,
    getBlueprintById,
    updateBlueprint,
    deleteBlueprint,
    subscribeToBlueprint,
    unsubscribeFromBlueprint,
    searchBlueprints,
    refresh,
  };
}