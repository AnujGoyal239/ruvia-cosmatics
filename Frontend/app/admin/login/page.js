export default function AdminLoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDFBF7', padding: '16px' }}>
      <div style={{ maxWidth: '400px', width: '100%', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Admin Portal</h1>
          <p style={{ fontSize: '14px', color: '#666' }}>Ruvia Cosmetics Management</p>
        </div>

        <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Email</label>
            <input
              type="email"
              placeholder="admin@ruvia.com"
              required
              style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              required
              style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <button
            type="submit"
            style={{ width: '100%', padding: '12px', backgroundColor: '#333', color: 'white', borderRadius: '4px', fontWeight: '500', cursor: 'pointer' }}
          >
            Login
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <a href="/" style={{ fontSize: '14px', color: '#666', textDecoration: 'none' }}>
            ← Back to Website
          </a>
        </div>
      </div>
    </div>
  );
}
