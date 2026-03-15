export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface SignupInput {
  username: string;
  email: string;
  password: string;
  organizationName: string;
}

export interface AuthResult {
  jwt: string;
  user: AuthUser;
}
