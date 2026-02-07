import Link from 'next/link';

export default function NotFound() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            textAlign: 'center',
            fontFamily: 'Inter, sans-serif',
            backgroundColor: '#FFD753' // App theme yellow
        }}>
            <h1 style={{ fontSize: '4rem', fontWeight: '900', color: '#fff', textShadow: '2px 2px 0 #000' }}>404</h1>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>Page Not Found</h2>
            <p style={{ marginBottom: '2rem', color: '#555' }}>
                Could not find requested resource
            </p>
            <Link
                href="/"
                style={{
                    padding: '12px 24px',
                    backgroundColor: '#fff',
                    color: '#333',
                    borderRadius: '12px',
                    fontWeight: '800',
                    textDecoration: 'none',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    border: '2px solid #333'
                }}
            >
                Return Home
            </Link>
        </div>
    );
}
