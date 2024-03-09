import { NextResponse } from "next/server";

export async function POST(wallet) {
    const res = await fetch('https://apiwallets.onrender.com/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 'wallet': wallet }),
    })

    const data = await res.json()

    return NextResponse.json(data)
}