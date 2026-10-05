import React, { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, ArrowRightLeft, Check, AlertCircle, Percent, Sparkles, Store } from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { Order } from '../types';

interface CheckoutModalProps {
  order: Order | null;
  onClose: () => void;
  onSuccess: (updatedOrder: Order, ticket: any) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ order, onClose, onSuccess }) => {
  if (!order) return null;

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'app'>(order.type === 'delivery' ? 'app' : 'cash');
  const [tipPercent, setTipPercent] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>('');
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>('');
  const [tenderedStr, setTenderedStr] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    api.getDiscounts()
      .then(data => setDiscounts(data.filter((d: any) => d.is_active !== 0)))
      .catch(console.error);
  }, []);

  // Calculations
  const subtotal = order.subtotal || 0;
  const selectedDiscount = discounts.find(d => d.id.toString() === selectedDiscountId);
  const discountVal = selectedDiscount ? (subtotal * selectedDiscount.percentage) / 100 : 0;
  const tipVal = customTip !== '' ? (parseFloat(customTip) || 0) : ((subtotal * tipPercent) / 100);
  const totalToPay = Math.max(0, subtotal + (order.tax_amount || 0) + tipVal - discountVal);

  const tenderedVal = paymentMethod === 'cash' 
    ? (tenderedStr ? parseFloat(tenderedStr) || 0 : totalToPay)
    : totalToPay;

  const changeVal = Math.max(0, tenderedVal - totalToPay);
  const isInsufficient = paymentMethod === 'cash' && tenderedVal < totalToPay;

  useEffect(() => {
    // Default cash amount tendered to empty so quick buttons can be used easily
    setTenderedStr('');
  }, [totalToPay, paymentMethod]);

  const handleQuickCash = (amount: number | 'exact') => {
    if (amount === 'exact') {
      setTenderedStr(totalToPay.toFixed(2));
    } else {
      setTenderedStr(amount.toString());
    }
  };

  const handleNumPadClick = (val: string) => {
    if (val === 'C') {
      setTenderedStr('');
    } else if (val === 'BS') {
      setTenderedStr(prev => prev.slice(0, -1));
    } else if (val === '.') {
      if (!tenderedStr.includes('.')) {
        setTenderedStr(prev => (prev || '0') + '.');
      }
    } else {
      setTenderedStr(prev => prev + val);
    }
  };

  const handleConfirmCheckout = async () => {
    if (isInsufficient) {
      setErrorMsg('El efectivo recibido es menor al total a pagar.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await api.checkoutOrder(order.id, {
        payment_method: paymentMethod,
        amount_tendered: tenderedVal,
        tip_amount: tipVal,
        discount_amount: discountVal
      });

      // Confetti effect
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      onSuccess(res.order, res.ticket);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el cobro');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-orange-400">Procesar Cobro</span>
            <h2 className="text-xl font-black text-white">
              Orden #{order.order_number} {order.table_name ? `• ${order.table_name}` : (order.type === 'take_out' ? '• Para Llevar' : (order.type === 'pickup' ? '• Recoger' : ''))}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Totals & Methods & Tips */}
          <div className="flex flex-col gap-4">
            {/* Big Total Box */}
            <div className="bg-gradient-to-br from-orange-600 to-amber-600 p-5 rounded-2xl text-white shadow-lg shadow-orange-600/20">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-100">Total a Cobrar</span>
              <div className="text-4xl font-black mt-1">
                ${totalToPay.toFixed(2)}
              </div>
              <div className="flex justify-between text-xs text-orange-100 mt-2 pt-2 border-t border-white/20">
                <span>Subtotal: ${subtotal.toFixed(2)}</span>
                {tipVal > 0 && <span>Propina: +${tipVal.toFixed(2)}</span>}
                {discountVal > 0 && <span>Descuento: -${discountVal.toFixed(2)}</span>}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Forma de Pago</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-2xl border flex items-center justify-center gap-2.5 font-bold text-xs md:text-sm transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/50 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <DollarSign className="w-5 h-5 shrink-0" />
                  <span>Efectivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 rounded-2xl border flex items-center justify-center gap-2.5 font-bold text-xs md:text-sm transition-all ${
                    paymentMethod === 'card'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400 ring-2 ring-blue-500/50 shadow-md shadow-blue-500/10'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <CreditCard className="w-5 h-5 shrink-0" />
                  <span>Tarjeta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={`p-3 rounded-2xl border flex items-center justify-center gap-2.5 font-bold text-xs md:text-sm transition-all ${
                    paymentMethod === 'transfer'
                      ? 'bg-purple-600/20 border-purple-500 text-purple-400 ring-2 ring-purple-500/50 shadow-md shadow-purple-500/10'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <ArrowRightLeft className="w-5 h-5 shrink-0" />
                  <span>Transferencia</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('app')}
                  className={`p-3 rounded-2xl border flex items-center justify-center gap-2.5 font-bold text-xs md:text-sm transition-all ${
                    paymentMethod === 'app'
                      ? 'bg-pink-600/20 border-pink-500 text-pink-400 ring-2 ring-pink-500/50 shadow-md shadow-pink-500/10'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Store className="w-5 h-5 shrink-0" />
                  <span>App</span>
                </button>
              </div>
            </div>

            {/* Tip (Propina) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Propina Sugerida
                </label>
                {tipVal > 0 && <span className="text-xs font-bold text-amber-400">+${tipVal.toFixed(2)}</span>}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 10, 15, 20].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setTipPercent(pct);
                      setCustomTip('');
                    }}
                    className={`py-2 px-1 rounded-lg text-xs font-bold transition-all border ${
                      tipPercent === pct && customTip === ''
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {pct === 0 ? 'Sin propina' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Discount */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-rose-400" />
                Descuento
              </label>
              <select
                value={selectedDiscountId}
                onChange={e => setSelectedDiscountId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-orange-500"
              >
                <option value="">Sin descuento</option>
                {discounts.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.percentage}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Column: Cash Calculator or Method Info */}
          <div className="flex flex-col gap-4">
            {paymentMethod === 'cash' ? (
              <>
                {/* Tendered Input & Change Box */}
                <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold uppercase text-slate-400">Efectivo Recibido</span>
                    <span className="text-xs text-slate-400">Total: ${totalToPay.toFixed(2)}</span>
                  </div>
                  <div className="text-2xl font-black text-white bg-slate-950 p-2.5 rounded-xl border border-slate-700/80 text-right">
                    ${tenderedStr || totalToPay.toFixed(2)}
                  </div>

                  {/* Change Output */}
                  <div className="mt-3 pt-3 border-t border-slate-700/80 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-300">Cambio a Entregar:</span>
                    <span className={`text-2xl font-black ${isInsufficient ? 'text-rose-400' : 'text-emerald-400'}`}>
                      ${changeVal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Quick Bill Buttons */}
                <div className="grid grid-cols-5 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickCash('exact')}
                    className="py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Exacto
                  </button>
                  {[100, 200, 500, 1000].map(bill => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => handleQuickCash(bill)}
                      className="py-2 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 text-emerald-300 rounded-lg text-xs font-black transition-colors"
                    >
                      ${bill}
                    </button>
                  ))}
                </div>

                {/* Numeric Keypad for Touch */}
                <div className="grid grid-cols-3 gap-1.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BS'].map(key => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleNumPadClick(key)}
                      className={`py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                        key === 'C'
                          ? 'bg-rose-950/40 border border-rose-800/50 text-rose-300 hover:bg-rose-900/60'
                          : key === 'BS'
                          ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                          : 'bg-slate-800 border border-slate-700/80 text-white hover:bg-slate-700'
                      }`}
                    >
                      {key === 'BS' ? '⌫ Borrar' : (key === 'C' ? 'Limpiar' : key)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl flex flex-col items-center justify-center text-center h-full">
                {paymentMethod === 'card' ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                      <CreditCard className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-lg text-white">Pago con Terminal / Tarjeta</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Inserta o aproxima la tarjeta en la terminal bancaria por el monto exacto de:
                    </p>
                    <div className="text-3xl font-black text-blue-400 mt-3">
                      ${totalToPay.toFixed(2)}
                    </div>
                  </>
                ) : paymentMethod === 'app' ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center mb-3">
                      <Store className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-lg text-white">Pago por Aplicación</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      El pago fue gestionado externamente a través de una aplicación de terceros.
                    </p>
                    <div className="text-3xl font-black text-pink-400 mt-3">
                      ${totalToPay.toFixed(2)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
                      <ArrowRightLeft className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-lg text-white">Transferencia / SPEI</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Verifica la recepción de la transferencia bancaria por:
                    </p>
                    <div className="text-3xl font-black text-purple-400 mt-3">
                      ${totalToPay.toFixed(2)}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="px-6 py-2 bg-rose-950/80 border-t border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-slate-800/90 border-t border-slate-700 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-2xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-sm transition-colors"
          >
            Cancelar
          </button>
          
          <button
            type="button"
            disabled={isSubmitting || isInsufficient}
            onClick={handleConfirmCheckout}
            className={`px-8 py-3.5 rounded-2xl font-black text-base flex items-center gap-2 shadow-xl transition-all ${
              isSubmitting || isInsufficient
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 hover:scale-[1.02] active:scale-95'
            }`}
          >
            <Check className="w-5 h-5" />
            {isSubmitting ? 'Procesando...' : `Confirmar y Cobrar $${totalToPay.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
};
