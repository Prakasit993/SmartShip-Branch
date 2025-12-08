'use client';

import { useEffect, useState, FormEvent } from 'react';
import QRCode from 'react-qr-code';
import { supabase } from '@/lib/supabaseClient';


type Branch = {
  id: string;
  name: string;
  address_line: string | null;
  district: string | null;
  province: string | null;
  postal_code: string | null;
  code?: string | null;
};

type FormState = {
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddressLine: string;
  receiverSubdistrict: string;
  receiverDistrict: string;
  receiverProvince: string;
  receiverPostalCode: string;
};

const initialForm: FormState = {
  senderName: '',
  senderPhone: '',
  receiverName: '',
  receiverPhone: '',
  receiverAddressLine: '',
  receiverSubdistrict: '',
  receiverDistrict: '',
  receiverProvince: '',
  receiverPostalCode: '',
};

export default function NewShipmentPage() {
  const [branch, setBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loadingBranch, setLoadingBranch] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastShipmentId, setLastShipmentId] = useState<string | null>(null);

  // ดึงสาขาแรกจากตาราง branches
  useEffect(() => {
    const fetchBranch = async () => {
      setLoadingBranch(true);
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        console.error(error);
        setError('โหลดข้อมูลสาขาไม่สำเร็จ');
      } else {
        setBranch(data as Branch);
      }
      setLoadingBranch(false);
    };

    fetchBranch();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!branch) {
      setError('ยังไม่มีข้อมูลสาขา กรุณาตรวจสอบใน Supabase');
      return;
    }

    if (!form.senderPhone || !form.receiverName || !form.receiverPhone) {
      setError('กรุณากรอกอย่างน้อย เบอร์ผู้ส่ง + ชื่อ/เบอร์ผู้รับ');
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase
      .from('shipments')
      .insert({
        branch_id: branch.id,
        customer_id: null,

        sender_name: form.senderName || 'ลูกค้าหน้าร้าน',
        sender_phone: form.senderPhone,
        sender_address_line: branch.address_line ?? '',
        sender_district: branch.district ?? '',
        sender_province: branch.province ?? '',
        sender_postal_code: branch.postal_code ?? '',

        receiver_name: form.receiverName,
        receiver_phone: form.receiverPhone,
        receiver_address_line: form.receiverAddressLine,
        receiver_subdistrict: form.receiverSubdistrict,
        receiver_district: form.receiverDistrict,
        receiver_province: form.receiverProvince,
        receiver_postal_code: form.receiverPostalCode,

        status: 'draft',
        address_validated: false,
        address_needs_staff_review: false,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setError(error.message);
    } else {
      setSuccess(`สร้าง shipment สำเร็จ (id: ${data.id})`);
      setLastShipmentId(data.id);
      setForm(initialForm);
    }

    setSubmitting(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 flex justify-center py-10 px-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold">สร้างพัสดุใหม่ (Draft)</h1>

        {loadingBranch && <p>กำลังโหลดข้อมูลสาขา…</p>}
        {branch && (
          <p className="text-sm text-slate-600">
            สาขาปัจจุบัน: <span className="font-semibold">{branch.name}</span>{' '}
            ({branch.address_line}, {branch.district}, {branch.province},{' '}
            {branch.postal_code})
          </p>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {lastShipmentId && branch && (
          <div className="rounded-md bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-slate-700 space-y-2">
            <p className="font-medium">
              QR สำหรับใช้ในขั้นตอนรับเข้าระบบ J&amp;T (UC-02)
            </p>
            <p className="text-xs text-slate-500">
              ภายใน QR จะมีข้อมูล shipment_id และ branch_code เพื่อใช้ดึงข้อมูลจาก SmartShip
            </p>
            <div className="bg-white inline-block p-3 rounded-lg">
              <QRCode
                value={JSON.stringify({
                  shipment_id: lastShipmentId,
                  branch_code: branch.code,
                })}
                size={140}
              />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ผู้ส่ง */}
          <section className="space-y-2">
            <h2 className="font-semibold">ข้อมูลผู้ส่ง</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">ชื่อผู้ส่ง</label>
                <input
                  name="senderName"
                  value={form.senderName}
                  onChange={handleChange}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="ถ้าไม่ใส่จะใช้ค่า 'ลูกค้าหน้าร้าน'"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">เบอร์ผู้ส่ง *</label>
                <input
                  name="senderPhone"
                  value={form.senderPhone}
                  onChange={handleChange}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="เช่น 0812345678"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              ที่อยู่ผู้ส่งจะใช้ที่อยู่ของสาขาโดยอัตโนมัติ
            </p>
          </section>

          {/* ผู้รับ */}
          <section className="space-y-2">
            <h2 className="font-semibold">ข้อมูลผู้รับ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">ชื่อผู้รับ *</label>
                <input
                  name="receiverName"
                  value={form.receiverName}
                  onChange={handleChange}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">เบอร์ผู้รับ *</label>
                <input
                  name="receiverPhone"
                  value={form.receiverPhone}
                  onChange={handleChange}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-sm mb-1">ที่อยู่ (บ้านเลขที่/หมู่/ถนน)</label>
                <input
                  name="receiverAddressLine"
                  value={form.receiverAddressLine}
                  onChange={handleChange}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">ตำบล</label>
                  <input
                    name="receiverSubdistrict"
                    value={form.receiverSubdistrict}
                    onChange={handleChange}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">อำเภอ</label>
                  <input
                    name="receiverDistrict"
                    value={form.receiverDistrict}
                    onChange={handleChange}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">จังหวัด</label>
                  <input
                    name="receiverProvince"
                    value={form.receiverProvince}
                    onChange={handleChange}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">รหัสไปรษณีย์</label>
                  <input
                    name="receiverPostalCode"
                    value={form.receiverPostalCode}
                    onChange={handleChange}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={submitting || loadingBranch}
            className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium disabled:opacity-60"
          >
            {submitting ? 'กำลังบันทึก…' : 'บันทึกเป็น Draft'}
          </button>
        </form>

        {lastShipmentId && (
          <section className="pt-4">
            <h3 className="font-semibold">ลิงก์พัสดุ / QR Code</h3>
            <div className="mt-2 flex items-start gap-4">
              <div className="bg-white p-3 border rounded">
                <QRCode
                  value={typeof window !== 'undefined' ? `${window.location.origin}/shipments/${lastShipmentId}` : lastShipmentId}
                  size={128}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600 break-all">{typeof window !== 'undefined' ? `${window.location.origin}/shipments/${lastShipmentId}` : lastShipmentId}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const url = `${window.location.origin}/shipments/${lastShipmentId}`;
                        await navigator.clipboard.writeText(url);
                        setSuccess('ลิงก์ถูกคัดลอกแล้ว');
                      } catch (err) {
                        setError('คัดลอกลิงก์ไม่สำเร็จ');
                      }
                    }}
                    className="px-3 py-2 rounded-md bg-slate-100 text-sm"
                  >
                    คัดลอกลิงก์
                  </button>
                  <a
                    href={typeof window !== 'undefined' ? `${window.location.origin}/shipments/${lastShipmentId}` : '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm"
                  >
                    เปิดหน้าพัสดุ
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
