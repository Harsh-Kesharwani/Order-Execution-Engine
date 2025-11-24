const sockets = new Map<string, Set<any>>();

export function registerSocketForOrder(orderId: string, socket: any) {
    if (!sockets.has(orderId)) sockets.set(orderId, new Set());
    sockets.get(orderId)!.add(socket);
    socket.on('close', () => sockets.get(orderId)?.delete(socket));
}

export function emitStatus(orderId: string, payload: any) {
    const set = sockets.get(orderId);
    if (!set) return;
    const msg = JSON.stringify(payload);
    for (const s of set) {
        console.log("emit: "+msg)
        s.send(msg);
    }
}