'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { Upload, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import Image from 'next/image';
import { generatePromptPayPayload, onSlipUploaded } from '@app/actions/payment'; // Server Action

// --- Types ---
interface Order {
    id: number;
    friendly_id: string;
    total_amount: number;
    status: string;
    payment_status: string;
    customer_name: string;
    created_at: string;
    payment_slip_url?: string;
}

export default function ResumePaymentPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [qrCodeData, setQrCodeData] = useState<string>('');

    // --- 1. Fetch Order ---
    useEffect(() => {
        const fetchOrder = async () => {
            if (!id) return;

            // Try to find by friendly_id first (e.g. EX-2026-001)
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .or(`friendly_id.eq.${id},order_no.eq.${id}`)
                .single();

            if (data) {
                setOrder(data);

                // Generate Payload on Server (Avoids Buffer issues)
                const payload = await generatePromptPayPayload(data.total_amount);
                setQrCodeData(payload);
            }
            setLoading(false);
        };

        fetchOrder();
    }, [id]);

    // --- 2. Handle Slip Upload ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file || !order) return;
        setUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${order.friendly_id || order.id}_${Date.now()}.${fileExt}`;
            const filePath = `slips/${fileName}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('slips') // Ensure this bucket exists!
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('slips')
                .getPublicUrl(filePath);

            // 3. Update Order Status
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    payment_status: 'pending', // 'pending' review
                    payment_slip_url: publicUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', order.id);

            if (updateError) throw updateError;

            // Notify Admin via LINE
            await onSlipUploaded(order.id);

            alert('Payment slip uploaded successfully!');
            // Refresh local state
            setOrder({ ...order, payment_status: 'pending', payment_slip_url: publicUrl });
            setFile(null);

        } catch (error: any) {
            console.error('Upload error:', error);
            alert(`Failed to upload: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    // --- Render ---
    if (loading) return <div className="p-8 text-center">Loading order...</div>;
    if (!order) return <div className="p-8 text-center text-red-500">Order not found.</div>;

    const isPaid = order.payment_status === 'paid';
    const isPending = order.payment_status === 'pending'; // Pending Review
    const needsPayment = order.payment_status === 'unpaid' || order.payment_status === 'rejected';

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-12 px-4">
            <div className="max-w-md mx-auto bg-white dark:bg-black rounded-xl shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">

                {/* Header */}
                <div className="bg-zinc-900 text-white p-6 text-center">
                    <h1 className="text-xl font-bold">Payment for {order.friendly_id || order.id}</h1>
                    <p className="text-zinc-400 text-sm mt-1">Total Amount</p>
                    <p className="text-3xl font-bold mt-2">฿{order.total_amount.toLocaleString()}</p>
                </div>

                {/* Status Banner */}
                {isPaid && (
                    <div className="bg-green-100 text-green-800 p-4 flex items-center justify-center gap-2 font-bold">
                        <CheckCircle size={20} /> Payment Completed
                    </div>
                )}
                {isPending && (
                    <div className="bg-yellow-100 text-yellow-800 p-4 flex items-center justify-center gap-2 font-bold">
                        <AlertCircle size={20} /> Slip Uploaded - Waiting for Review
                    </div>
                )}
                {order.payment_status === 'rejected' && (
                    <div className="bg-red-100 text-red-800 p-4 flex items-center justify-center gap-2 font-bold">
                        <AlertCircle size={20} /> Payment Rejected - Please Retry
                    </div>
                )}

                {/* Content */}
                <div className="p-6 space-y-8">

                    {/* QR Code Section (Only if needs payment) */}
                    {needsPayment && (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
                                <QRCode value={qrCodeData} size={200} />
                            </div>
                            <p className="text-sm text-center text-zinc-500">
                                Scan with any Banking App<br />
                                (PromptPay)
                            </p>
                        </div>
                    )}

                    {/* Upload Section */}
                    {needsPayment && (
                        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <Upload size={18} /> Upload Transfer Slip
                            </h3>

                            <div className="space-y-4">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="block w-full text-sm text-zinc-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-full file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-zinc-100 file:text-zinc-700
                                        hover:file:bg-zinc-200
                                    "
                                />
                                {file && (
                                    <button
                                        onClick={handleUpload}
                                        disabled={uploading}
                                        className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-3 rounded-lg hover:opacity-80 transition disabled:opacity-50"
                                    >
                                        {uploading ? 'Uploading...' : 'Confirm Payment'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Show existing slip if any */}
                    {order.payment_slip_url && (
                        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
                            <p className="text-sm font-medium mb-2">Latest Slip:</p>
                            <div className="relative aspect-[3/4] w-full bg-zinc-100 rounded-lg overflow-hidden">
                                <Image
                                    src={order.payment_slip_url}
                                    alt="Payment Slip"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 text-center text-xs text-zinc-500">
                    Order created on {new Date(order.created_at).toLocaleString('th-TH')}
                </div>
            </div>
        </div>
    );
}
