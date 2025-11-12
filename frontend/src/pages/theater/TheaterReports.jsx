import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import config from '../../config';
import { ultraFetch, useUltraFetch } from '../../utils/ultraFetch';


function TheaterReports() {
  const { theaterId } = useParams();
  const { rolePermissions, user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [myStats, setMyStats] = useState({
    myOrders: 0,
    myRevenue: 0,
    myCategories: []
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Determine user's role
  const userRole = rolePermissions?.[0]?.role?.name || 'Unknown';
  const isTheaterAdmin = userRole === 'Theater Admin';

  // ✅ Fetch user-specific stats on load (for non-admin users)
  useEffect(() => {
    if (!isTheaterAdmin) {
      fetchMyStats();
    }
  }, [isTheaterAdmin, theaterId]);

  const fetchMyStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${config.api.baseUrl}/reports/my-stats/${theaterId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMyStats(data.stats);
      } else {
  }
    } catch (error) {
  }
  };

  // ✅ Download Full Report (Theater Admin only)
  const handleDownloadFullReport = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('authToken');
      
      // Build query string
      const params = new URLSearchParams({
        format: 'csv'
      });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(
        `${config.api.baseUrl}/reports/full-report/${theaterId}?${params.toString()}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        // Download CSV file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `full_report_${theaterId}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setSuccess('✅ Full report downloaded successfully!');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to download report');
      }
    } catch (error) {

      setError('Failed to download report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Download Excel Report
  const handleDownloadExcel = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('authToken');
      
      // Build query string
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(
        `${config.api.baseUrl}/reports/excel/${theaterId}?${params.toString()}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        // Download Excel file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = startDate ? `_${startDate.replace(/-/g, '')}` : '';
        a.download = `Sales_Report${dateStr}_${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setSuccess('✅ Excel report downloaded successfully!');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to download Excel report');
      }
    } catch (error) {

      setError('Failed to download Excel report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Download My Sales Report (All roles)
  const handleDownloadMySales = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('authToken');
      
      // Build query string
      const params = new URLSearchParams({
        format: 'csv'
      });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(
        `${config.api.baseUrl}/reports/my-sales/${theaterId}?${params.toString()}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        // Download CSV file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my_sales_${user?.username || 'user'}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setSuccess(`✅ ${isTheaterAdmin ? 'Full report' : 'Your sales report'} downloaded successfully!`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to download report');
      }
    } catch (error) {

      setError('Failed to download report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TheaterLayout pageTitle="Reports" currentPage="reports">
      <PageContainer
        title="Sales Reports"
        subtitle={`Download reports for ${isTheaterAdmin ? 'all data' : 'your assigned data'}`}
      >
        {/* ✅ User-specific stats for non-admin */}
        {!isTheaterAdmin && (
          <div style={{ 
            backgroundColor: '#fef3c7', 
            padding: '20px', 
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #fbbf24'
          }}>
            <h3 style={{ marginTop: 0 }}>📊 Your Statistics</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '15px',
              marginTop: '15px'
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Your Orders</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                  {myStats.myOrders}
                </div>
              </div>
              <div style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Your Revenue</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>
                  ₹{myStats.myRevenue.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Your Categories</div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937', marginTop: '5px' }}>
                  {myStats.myCategories.length > 0 ? myStats.myCategories.join(', ') : 'None assigned'}
                </div>
              </div>
            </div>
            <p style={{ marginTop: '15px', marginBottom: 0, fontSize: '14px', color: '#666' }}>
              ℹ️ You can only download reports for your assigned categories
            </p>
          </div>
        )}

        {/* Date Range Filter */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0 }}>📅 Filter by Date Range (Optional)</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '15px' 
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Clear Dates
            </button>
          )}
        </div>

        {/* Download Buttons */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0 }}>📥 Download Reports</h3>
          
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            {/* Excel Report Button (All users) */}
            <button
              onClick={handleDownloadExcel}
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: loading ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? '⏳ Downloading...' : '📊 Download Excel Report'}
            </button>

            {/* Theater Admin - Full Report Button */}
            {isTheaterAdmin && (
              <button
                onClick={handleDownloadFullReport}
                disabled={loading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {loading ? '⏳ Downloading...' : '� Download CSV (All Data)'}
              </button>
            )}

            {/* My Sales Button (All users) */}
            <button
              onClick={handleDownloadMySales}
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: loading ? '#9ca3af' : isTheaterAdmin ? '#6366f1' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? '⏳ Downloading...' : isTheaterAdmin ? '📈 CSV (My Sales Endpoint)' : '📈 Download My Sales (CSV)'}
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div style={{
            padding: '15px',
            backgroundColor: '#d1fae5',
            border: '1px solid #10b981',
            borderRadius: '6px',
            marginBottom: '20px',
            color: '#065f46'
          }}>
            {success}
          </div>
        )}

        {error && (
          <div style={{
            padding: '15px',
            backgroundColor: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '6px',
            marginBottom: '20px',
            color: '#991b1b'
          }}>
            {error}
          </div>
        )}

        {/* Information Box */}
        <div style={{ 
          marginTop: '30px',
          padding: '20px',
          backgroundColor: isTheaterAdmin ? '#dbeafe' : '#fef3c7',
          borderRadius: '8px',
          border: isTheaterAdmin ? '1px solid #3b82f6' : '1px solid #fbbf24'
        }}>
          <h3 style={{ marginTop: 0 }}>
            {isTheaterAdmin ? '✅ Theater Admin Access' : '⚠️ User-Specific Access'}
          </h3>
          {isTheaterAdmin ? (
           <div>
              <p style={{ marginBottom: '10px' }}>
                As Theater Admin, you have full access to:
              </p>
              <ul style={{ marginLeft: '20px', marginBottom: 0 }}>
                <li>✅ Download ALL orders and sales data from ALL users</li>
                <li>✅ Complete financial information</li>
                <li>✅ Data from all categories and products</li>
                <li>✅ Two download options: Full Report or My Sales endpoint</li>
              </ul>
            </div> 
          ) : (
            <div>
              <p style={{ marginBottom: '10px' }}>
                As <strong>{user?.username || 'user'}</strong> (<strong>{userRole}</strong>), you can download:
              </p>
              <ul style={{ marginLeft: '20px', marginBottom: '10px' }}>
                <li>✅ Sales data for <strong>YOUR</strong> assigned categories/products only</li>
                <li>✅ Orders within <strong>YOUR</strong> assigned scope</li>
                <li>❌ You CANNOT access other users' data</li>
                <li>❌ You CANNOT download complete financial data</li>
              </ul>
              <p style={{ 
                marginBottom: 0, 
                padding: '10px', 
                backgroundColor: 'white', 
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                <strong>Note:</strong> Even if another user has the same role as you, you cannot see their data.
                Each user can only view and download their own assigned data.
              </p>
            </div>
          )}
        </div>
      </PageContainer>
    </TheaterLayout>
  );
}

export default TheaterReports;
