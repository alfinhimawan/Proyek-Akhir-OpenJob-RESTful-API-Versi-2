import { nanoid } from 'nanoid';

export const generateId = (prefix) => `${prefix}-${nanoid(16)}`;
