import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    getUserGroups, 
    getGroupById, 
    createGroup, 
    updateGroup, 
    deleteGroup,
    type GroupDocument,
    type CreateGroupParams
} from '@/api/group';
import { showToast } from '@/utils/showToast';

export interface UseGroupsReturn {
    // Groups data
    groups: GroupDocument[];
    isLoading: boolean;
    error: string | null;
    
    // Mutations
    createNewGroup: (params: CreateGroupParams) => Promise<GroupDocument>;
    updateExistingGroup: (groupId: string, name: string) => Promise<void>;
    deleteExistingGroup: (groupId: string) => Promise<void>;
    
    // Mutation loading states
    isCreating: boolean;
    isUpdating: boolean;
    isDeleting: boolean;
    
    // Refresh
    refresh: () => void;
}

export const useGroups = (): UseGroupsReturn => {
    const queryClient = useQueryClient();

    // Query for fetching all user groups
    const {
        data: groupsData,
        isLoading,
        error: queryError,
        refetch: refresh,
    } = useQuery({
        queryKey: ['groups'],
        queryFn: getUserGroups,
        staleTime: 60000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
    });

    // Mutation for creating a group
    const createGroupMutation = useMutation({
        mutationFn: async (params: CreateGroupParams) => {
            console.log('🟢 useGroups: Starting createGroup mutation with:', params);
            const result = await createGroup(params);
            console.log('🟢 useGroups: createGroup mutation result:', result);
            return result;
        },
        onSuccess: (newGroup) => {
            console.log('🟢 useGroups: onSuccess called with:', newGroup);
            
            // Optimistically update the cache with the new group
            queryClient.setQueryData(['groups'], (oldData: GroupDocument[] | undefined) => {
                console.log('🟢 useGroups: Updating cache. Old data:', oldData);
                if (!oldData) return [newGroup];
                const newData = [...oldData, newGroup];
                console.log('🟢 useGroups: New cache data:', newData);
                return newData;
            });
            
            // Also invalidate to ensure sync with backend
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            
            if (newGroup?.name) {
                showToast(`Group "${newGroup.name}" created successfully!`, 'success');
            } else {
                showToast('Group created successfully!', 'success');
            }
        },
        onError: (error: Error) => {
            console.error('🔴 useGroups: onError called with:', error);
            console.error('🔴 useGroups: Error stack:', error.stack);
            showToast(error.message || 'Failed to create group', 'danger');
        },
    });

    // Mutation for updating a group
    const updateGroupMutation = useMutation({
        mutationFn: ({ groupId, name }: { groupId: string; name: string }) => 
            updateGroup(groupId, name),
        onSuccess: (_, variables) => {
            // Update the group in the cache
            queryClient.setQueryData(['groups'], (oldData: GroupDocument[] | undefined) => {
                if (!oldData) return oldData;
                return oldData.map(group => 
                    group._id === variables.groupId 
                        ? { ...group, name: variables.name }
                        : group
                );
            });
            
            showToast('Group updated successfully!', 'success');
        },
        onError: (error: Error) => {
            console.error('Failed to update group:', error);
            showToast(error.message || 'Failed to update group', 'danger');
        },
    });

    // Mutation for deleting a group
    const deleteGroupMutation = useMutation({
        mutationFn: deleteGroup,
        onSuccess: (_, groupId) => {
            // Remove the group from the cache
            queryClient.setQueryData(['groups'], (oldData: GroupDocument[] | undefined) => {
                if (!oldData) return oldData;
                return oldData.filter(group => group._id !== groupId);
            });
            
            showToast('Group deleted successfully!', 'success');
        },
        onError: (error: Error) => {
            console.error('Failed to delete group:', error);
            showToast(error.message || 'Failed to delete group', 'danger');
        },
    });

    // Wrapper functions for mutations
    const createNewGroup = async (params: CreateGroupParams): Promise<GroupDocument> => {
        return await createGroupMutation.mutateAsync(params);
    };

    const updateExistingGroup = async (groupId: string, name: string): Promise<void> => {
        await updateGroupMutation.mutateAsync({ groupId, name });
    };

    const deleteExistingGroup = async (groupId: string): Promise<void> => {
        await deleteGroupMutation.mutateAsync(groupId);
    };

    return {
        // Data
        groups: groupsData || [],
        isLoading,
        error: queryError ? 'Failed to load groups' : null,
        
        // Mutations
        createNewGroup,
        updateExistingGroup,
        deleteExistingGroup,
        
        // Loading states
        isCreating: createGroupMutation.isPending,
        isUpdating: updateGroupMutation.isPending,
        isDeleting: deleteGroupMutation.isPending,
        
        // Refresh
        refresh,
    };
};

// Hook for fetching a single group by ID
export const useGroup = (groupId: string | null) => {
    const {
        data: group,
        isLoading,
        error: queryError,
        refetch: refresh,
    } = useQuery({
        queryKey: ['group', groupId],
        queryFn: () => groupId ? getGroupById(groupId) : Promise.resolve(null),
        enabled: !!groupId,
        staleTime: 60000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
    });

    return {
        group: group || null,
        isLoading,
        error: queryError ? 'Failed to load group' : null,
        refresh,
    };
};

