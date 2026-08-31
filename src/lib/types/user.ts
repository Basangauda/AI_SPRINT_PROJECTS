export type User = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  group: string;
};

export type UserWithHash = User & {
  passwordHash: string;
};

export type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  group_name: string;
  password_hash: string;
  created_at?: string;
  updated_at?: string;
};

export type CreateUserInput = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  group: string;
  password: string;
};

export type UpdateUserInput = {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  group?: string;
  password?: string;
};

export function userWithoutPassword(user: UserWithHash): User {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    group: user.group,
  };
}
