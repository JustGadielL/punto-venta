import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const swalConfig = {
  background: '#0f172a', // slate-900
  color: '#f8fafc', // slate-50
  customClass: {
    popup: 'border border-slate-800 rounded-3xl',
    confirmButton: 'px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-bold shadow-lg transition-all mx-2',
    cancelButton: 'px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all mx-2',
  },
  buttonsStyling: false
};

export const customAlert = (message: string) => {
  return MySwal.fire({
    ...swalConfig,
    text: message,
    icon: 'info',
    confirmButtonText: 'Entendido'
  });
};

export const customConfirm = async (message: string) => {
  const result = await MySwal.fire({
    ...swalConfig,
    text: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, continuar',
    cancelButtonText: 'Cancelar'
  });
  return result.isConfirmed;
};
