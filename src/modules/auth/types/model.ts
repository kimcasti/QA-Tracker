export interface AuthUser {
  id: number;
  username: string;
  email: string;
  isSuperAdmin?: boolean;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface SignupInput {
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  contactNumber: string;
  organizationName: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  code: string;
  password: string;
  passwordConfirmation: string;
}

export interface AuthResult {
  jwt: string;
  user: AuthUser;
}
