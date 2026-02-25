async function check() {
    const response = await fetch('http://localhost:3000/api/stats');
    const data = await response.json();
    console.log('Stats for TWO:', data['TWO']);
}
check();
