import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#2563EB]">
                <div className="text-white font-bold text-3xl font-[Inter]">
                    Diligence Finance
                </div>
            </div>
        );
    }

    return user ? <Outlet /> : <Navigate to="/" replace />;
}
