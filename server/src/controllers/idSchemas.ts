/**
 * Die ID-Prüfungen der Routen-Parameter – von allen Controllern geteilt (#465). Eine Fassung, damit
 * „positive ganze Zahl" nicht in jedem Controller neu steht.
 */
import { z } from 'zod';

export const idSchema = z.coerce.number().int().positive();

export const arrSchema = z.coerce.number().int().positive().optional();
