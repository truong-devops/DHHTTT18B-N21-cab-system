import { apiRequest } from '../lib/api';
import { endpoints } from '../lib/endpoints';

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function getUserById(id: string) {
  return apiRequest<{ data: UserProfile }>({
    method: 'GET',
    path: endpoints.user.detail(id)
  });
}

export async function updateUser(id: string, payload: Partial<Pick<UserProfile, 'email' | 'fullName' | 'phone'>>) {
  return apiRequest<{ data: UserProfile }>({
    method: 'PATCH',
    path: endpoints.user.detail(id),
    body: payload
  });
}
