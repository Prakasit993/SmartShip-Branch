'use client';

import { deleteProduct } from '../actions';

interface DeleteProductButtonProps {
    id: number;
}

export default function DeleteProductButton({ id }: DeleteProductButtonProps) {
    const handleDelete = async (e: React.FormEvent) => {
        if (!confirm('Are you sure you want to delete this product?')) {
            e.preventDefault();
        }
    };

    return (
        <form action={deleteProduct.bind(null, id)} className="inline" onSubmit={handleDelete}>
            <button
                type="submit"
                className="text-red-600 hover:text-red-900 transition"
            >
                Delete
            </button>
        </form>
    );
}
