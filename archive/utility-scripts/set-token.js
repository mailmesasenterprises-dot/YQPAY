// Auto-set auth token in localStorage
(function() {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZDY0ZTliMzE0NWE0NWUzN2ZiMGUyMyIsInVzZXJUeXBlIjoidGhlYXRlcl91c2VyIiwidGhlYXRlciI6IjY4ZDM3ZWE2NzY3NTJiODM5OTUyYWY4MSIsInRoZWF0ZXJJZCI6IjY4ZDM3ZWE2NzY3NTJiODM5OTUyYWY4MSIsInBlcm1pc3Npb25zIjpbXSwiaWF0IjoxNzU5MjE2MDMxLCJleHAiOjE3NTkzMDI0MzF9.-wVOPDJle4aw-UyURVWRn7olXefc0ANZQJ0Wy6yfZPU";
    
    localStorage.setItem('authToken', token);
    console.log('✅ Auth token set successfully!');
    console.log('🔄 Refreshing page...');
    window.location.reload();
})();