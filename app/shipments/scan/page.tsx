'use client';

import { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { supabase } from '@/lib/supabaseClient';

type Shipment = {
  id: string;
  branch_id: string;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address_line: string;
  receiver_subdistrict: string;
  receiver_district: string;
  receiver_province: string;
  receiver_postal_code: string;
  status: string;
};

type QrPayload = {
  shipment_id: string;
  branch_code?: string;
};

export default function ScanShipmentPage() {
  const [scanText, setScanText] = useState<string>('');
  const [payload, setPayload] = useState<QrPayload | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDecode = (text: string) => {
    // กันสแกนรัว ๆ
    if (scanText === text) return;

    setScanText(text);
    setMessage(null);
    setError(null);

    try {
      const parsed = JSON.parse(text) as QrPayload;
      if (!parsed.shipment_id) {
        throw new Error('ไม่พบ shipment_id ใน QR');
      }
      setPayload(parsed);
      fetchShipment(parsed.shipment_id);
    } catch (e: any) {
      console.error(e);
      setError('QR นี้ไม่ใช่รูปแบบที่ระบบรู้จัก');
      setPayload(null);
      setShipment(null);
    }
  };

  const fetchShipment = async (shipmentId: string) => {
    setLoading(true);
    setShipment(null);
    setMessage(null);
    setError(null);

    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', shipmentId)
      .single();

    if (error) {
      console.error(error);
      setError('ไม่พบข้อมูลพัสดุจาก QR นี้');
    } else {
      setShipment(data as Shipment);
    }

    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!shipment) return;
    setLoading(true);
    setMessage(null);
    setError(null);

    const { error } = await supabase
      .from('shipments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: 'demo_staff', // ภายหลังค่อยเปลี่ยนเป็น user จริง
      })
      .eq('id', shipment.id);

    if (error) {
      console.error(error);
      setError('อัปเดตสถานะไม่สำเร็จ');
    } else {
      setMessage('ยืนยันรับพัสดุ (จำลองส่งเข้า J&T) สำเร็จแล้ว');
      setShipment({ ...shipment, status: 'confirmed' });
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 flex justify-center py-8 px-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold">สแกน QR &amp; ยืนยันพัสดุ (UC-02)</h1>

        <p className="text-sm text-slate-600">
          ใช้กล้องสแกน QR ที่สร้างจากหน้า “สร้างพัสดุใหม่ (Draft)” หรือวางข้อความ
          JSON ลงช่องด้านล่างก็ได้
        </p>

        {/* กล้องสแกน */}
        <div className="rounded-xl border bg-slate-900/90 text-white p-3 flex flex-col items-center gap-2">
          <p className="text-sm mb-1">สแกน QR จากกล้อง</p>
          <div className="w-full max-w-xs aspect-square overflow-hidden rounded-lg bg-black">
            <Scanner
              onScan={(result) => {
                if (!result || result.length === 0) return;
                // ใช้ข้อความดิบจากผลสแกนตัวแรก
                handleDecode(result[0].rawValue);
              }}
              onError={(err) => {
                // ไม่ใช้ console.error เพื่อไม่ให้ Next โชว์ overlay แดง
                console.warn('QR scanner error:', err);
                setError('ไม่พบกล้อง หรือเบราว์เซอร์ไม่อนุญาตให้ใช้กล้อง — ยังสามารถวางข้อความ QR ด้านล่างเพื่อลองทดสอบได้');
              }}
            />
          </div>
        </div>

        {/* พื้นที่ debug / วาง QR payload เอง */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            ข้อความจาก QR (debug / วางเองได้)
          </label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm h-20"
            value={scanText}
            onChange={(e) => handleDecode(e.target.value)}
            placeholder='เช่น {"shipment_id":"...","branch_code":"BR001"}'
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {/* แสดงรายละเอียด shipment */}
        {payload && (
          <div className="rounded-md bg-slate-50 border px-3 py-2 text-xs text-slate-500">
            QR payload: shipment_id = <b>{payload.shipment_id}</b>{' '}
            {payload.branch_code && (
              <>
                , branch_code = <b>{payload.branch_code}</b>
              </>
            )}
          </div>
        )}

        {loading && <p className="text-sm text-slate-500">กำลังโหลดข้อมูล…</p>}

        {shipment && (
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg">
                รายละเอียดพัสดุจาก SmartShip
              </h2>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100">
                สถานะ: {shipment.status}
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <h3 className="font-medium mb-1">ผู้ส่ง</h3>
                <p>{shipment.sender_name}</p>
                <p className="text-slate-500 text-xs">
                  โทร: {shipment.sender_phone}
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-1">ผู้รับ</h3>
                <p>{shipment.receiver_name}</p>
                <p className="text-slate-500 text-xs">
                  โทร: {shipment.receiver_phone}
                </p>
              </div>
            </div>

            <div className="text-sm">
              <h3 className="font-medium mb-1">ที่อยู่ผู้รับ</h3>
              <p>
                {shipment.receiver_address_line},{' '}
                {shipment.receiver_subdistrict},{' '}
                {shipment.receiver_district},{' '}
                {shipment.receiver_province}{' '}
                {shipment.receiver_postal_code}
              </p>
            </div>

            <button
              type="button"
              disabled={loading || shipment.status !== 'draft'}
              onClick={handleConfirm}
              className="inline-flex px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium disabled:opacity-60"
            >
              {shipment.status === 'draft'
                ? 'ยืนยันรับพัสดุ (จำลองส่งเข้า J&T)'
                : 'พัสดุรายการนี้ถูกยืนยันแล้ว'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
