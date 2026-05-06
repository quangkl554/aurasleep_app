require('dotenv').config();

async function testGroq() {
    console.log("Testing Groq API with key:", process.env.GROQ_API_KEY ? "EXISTS" : "MISSING");
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: 'Hello' }]
            })
        });
        
        const data = await response.json();
        console.log("Status:", response.status);
        console.log("Data:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Test failed:", e.message);
    }
}

testGroq();
