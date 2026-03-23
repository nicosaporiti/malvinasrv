export const AIRCRAFT = {
    skyhawk: {
        id: 'skyhawk',
        name: 'A-4B Skyhawk',
        speed: 120,
        fireRate: 0.12,
        bulletDamage: 2,
        hp: 3,
        special: 'bomb_run',
        specialCharges: 3,
        color: '#5B8C5A',
        colorAlt: '#3d6b3c',
        description: 'Artilleria pesada. Fragil pero letal.',
        stats: { velocidad: 6, fuego: 8, blindaje: 4 }
    },
    mirage: {
        id: 'mirage',
        name: 'Mirage IIIEA',
        speed: 170,
        fireRate: 0.15,
        bulletDamage: 1,
        hp: 3,
        special: 'afterburner',
        specialCharges: 3,
        color: '#7B8FA8',
        colorAlt: '#5a6f88',
        description: 'Rapido y agil. Esquiva todo.',
        stats: { velocidad: 9, fuego: 5, blindaje: 4 }
    },
    dagger: {
        id: 'dagger',
        name: 'IAI Dagger',
        speed: 140,
        fireRate: 0.13,
        bulletDamage: 2,
        hp: 5,
        special: 'missile_salvo',
        specialCharges: 3,
        color: '#A8865B',
        colorAlt: '#886b3c',
        description: 'Equilibrado. Versatil en combate.',
        stats: { velocidad: 7, fuego: 7, blindaje: 6 }
    }
};

export const AIRCRAFT_LIST = Object.values(AIRCRAFT);
