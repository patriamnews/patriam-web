// Confirmación antes de acciones irreversibles.
// En la vista previa publicada (VITE_HASH) el visor no admite ventanas de confirmación, así que se omite.
export const confirmar = (mensaje) => (import.meta.env.VITE_HASH ? true : window.confirm(mensaje))
