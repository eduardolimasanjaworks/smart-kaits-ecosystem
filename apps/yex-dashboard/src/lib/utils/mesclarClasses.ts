// Utilitário pequeno para combinar classes Tailwind condicionais sem colisões.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export default function mesclarClasses(...entradas: ClassValue[]) {
  return twMerge(clsx(entradas));
}
