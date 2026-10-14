export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
}
export interface AuthResponse {
  user: AuthUser;
}
export interface LoginInput {
  email: string;
  password: string;
}
export interface RegisterInput extends LoginInput {
  full_name: string;
}
