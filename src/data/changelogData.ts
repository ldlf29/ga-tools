export interface ClassChange {
    id: string;
    date: string; // ISO format YYYY-MM-DD
    mokiName: string;
    oldClass: string;
    newClass: string;
    imageUrl?: string;
}

export const mockChangelogData: ClassChange[] = [
    {
        id: '1',
        date: '2024-01-29',
        mokiName: 'Puff',
        oldClass: 'Striker',
        newClass: 'Forward',
        imageUrl: 'https://images.lumiterra.net/moki/puff.png' // Placeholder, will be replaced by real logic if needed
    },
    {
        id: '2',
        date: '2024-01-28',
        mokiName: 'Spike',
        oldClass: 'Defender',
        newClass: 'Bruiser'
    },
    {
        id: '3',
        date: '2024-01-25',
        mokiName: 'Luna',
        oldClass: 'Support',
        newClass: 'Center'
    },
    {
        id: '4',
        date: '2024-01-20',
        mokiName: 'Rex',
        oldClass: 'Grinder',
        newClass: 'Anchor'
    },
    {
        id: '5',
        date: '2024-01-20',
        mokiName: 'Chrono',
        oldClass: 'Sprinter',
        newClass: 'Striker'
    }
];
