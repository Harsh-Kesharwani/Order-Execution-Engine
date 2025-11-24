function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export interface QuoteResult {
    dex: 'raydium' | 'meteora';
    price: number;
}

export class MockDexRouter {
    async getRaydiumQuote(): Promise<QuoteResult> {
        await sleep(200);
        const price = 0.98 + Math.random() * 0.04; // 0.98 – 1.02
        return { dex: 'raydium', price };
    }

    async getMeteoraQuote(): Promise<QuoteResult> {
        await sleep(200);
        const price = 0.97 + Math.random() * 0.05; // 0.97 – 1.02
        return { dex: 'meteora', price };
    }

    async executeSwap(dex: 'raydium' | 'meteora'): Promise<{ txHash: string; executedPrice: number }> {
        await sleep(2000 + Math.random() * 1000);
        const executedPrice = 0.97 + Math.random() * 0.05;
        const txHash = '0x' + Math.random().toString(16).slice(2).padEnd(64, '0');
        return { txHash, executedPrice };
    }
}
