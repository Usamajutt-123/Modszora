'use client';

import { useEffect, useRef } from 'react';

export default function ViewTracker({ slug }: { slug: string }) {
    const sent = useRef(false);

    useEffect(() => {
        if (sent.current) return;
        sent.current = true;

        const body = JSON.stringify({
            kind: 'view',
            slug,
        });

        if (navigator.sendBeacon) {
            navigator.sendBeacon(
                '/api/analytics',
                new Blob([body], {
                    type: 'application/json',
                })
            );
        } else {
            fetch('/api/analytics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body,
                keepalive: true,
            });
        }
    }, [slug]);

    return null;
}