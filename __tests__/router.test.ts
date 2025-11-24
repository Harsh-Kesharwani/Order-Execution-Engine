import { describe, it, expect } from '@jest/globals';

function chooseBest(side: 'buy'|'sell', a:{dex:string;price:number}, b:{dex:string;price:number}) {
    return side === 'buy' ? (a.price <= b.price ? a : b) : (a.price >= b.price ? a : b);
}

describe('routing chooseBest', () => {
    it('buy picks lower price', () => {
        expect(chooseBest('buy', {dex:'ray',price:1.02}, {dex:'met',price:1.01}).dex).toBe('met');
    });
    it('sell picks higher price', () => {
        expect(chooseBest('sell', {dex:'ray',price:1.02}, {dex:'met',price:1.01}).dex).toBe('ray');
    });
});

describe('slippage guard math', () => {
    const within = (q:number, e:number, bps:number, side:'buy'|'sell') => {
        const maxMove = (bps/10000)*q;
        return side==='buy' ? e <= q+maxMove : e >= q-maxMove;
    };
    it('buy within 1% passes', () => {
        expect(within(1.00, 1.009, 100, 'buy')).toBe(true);
    });
    it('buy beyond 1% fails', () => {
        expect(within(1.00, 1.012, 100, 'buy')).toBe(false);
    });
    it('sell within 1% passes', () => {
        expect(within(1.00, 0.991, 100, 'sell')).toBe(true);
    });
    it('sell beyond 1% fails', () => {
        expect(within(1.00, 0.985, 100, 'sell')).toBe(false);
    });
});
