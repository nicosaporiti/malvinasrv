export function aabb(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
}

export function checkCollisions(groupA, groupB, onHit) {
    for (let i = groupA.length - 1; i >= 0; i--) {
        const a = groupA[i];
        if (!a.alive) continue;
        for (let j = groupB.length - 1; j >= 0; j--) {
            const b = groupB[j];
            if (!b.alive) continue;
            if (aabb(a, b)) {
                onHit(a, b);
            }
        }
    }
}
