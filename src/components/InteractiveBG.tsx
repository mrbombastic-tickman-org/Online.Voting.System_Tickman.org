'use client';
import { useEffect, useRef } from 'react';

export default function InteractiveBG() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const orbsRef = useRef<Orb[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // Create orbs
        const colors = [
            { r: 168, g: 230, b: 207, a: 0.4 }, // mint
            { r: 195, g: 177, b: 225, a: 0.35 }, // lavender
            { r: 252, g: 228, b: 236, a: 0.35 }, // rose
            { r: 186, g: 230, b: 253, a: 0.3 },  // sky
            { r: 255, g: 212, b: 184, a: 0.25 },  // peach
        ];

        orbsRef.current = colors.map((color, i) => new Orb(
            Math.random() * canvas.width,
            Math.random() * canvas.height,
            150 + Math.random() * 200,
            color,
            0.3 + Math.random() * 0.5,
            i
        ));

        const onMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', onMouseMove);

        let animId: number;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            orbsRef.current.forEach(orb => {
                orb.update(mouseRef.current, canvas.width, canvas.height);
                orb.draw(ctx);
            });

            animId = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', onMouseMove);
            cancelAnimationFrame(animId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: -1,
                pointerEvents: 'none',
            }}
            aria-hidden="true"
        />
    );
}

class Orb {
    x: number;
    y: number;
    radius: number;
    color: { r: number; g: number; b: number; a: number };
    speed: number;
    baseX: number;
    baseY: number;
    angle: number;
    drift: number;
    mouseInfluence: number;
    vx: number;
    vy: number;

    constructor(
        x: number, y: number, radius: number,
        color: { r: number; g: number; b: number; a: number },
        speed: number, index: number
    ) {
        this.x = x;
        this.y = y;
        this.baseX = x;
        this.baseY = y;
        this.radius = radius;
        this.color = color;
        this.speed = speed;
        this.angle = (index * Math.PI * 2) / 5;
        this.drift = 80 + Math.random() * 60;
        this.mouseInfluence = 0.02 + Math.random() * 0.02;
        this.vx = 0;
        this.vy = 0;
    }

    update(mouse: { x: number; y: number }, w: number, h: number) {
        this.angle += 0.003 * this.speed;

        // Gentle orbit
        const targetX = this.baseX + Math.cos(this.angle) * this.drift;
        const targetY = this.baseY + Math.sin(this.angle * 0.7) * this.drift;

        // Mouse attraction — gently pulled toward cursor
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pull = Math.min(this.mouseInfluence, 80 / (dist + 1));

        this.vx += (targetX - this.x) * 0.01 + dx * pull * 0.3;
        this.vy += (targetY - this.y) * 0.01 + dy * pull * 0.3;

        // Damping
        this.vx *= 0.95;
        this.vy *= 0.95;

        this.x += this.vx;
        this.y += this.vy;

        // Wrap around edges
        if (this.x < -this.radius) this.x = w + this.radius;
        if (this.x > w + this.radius) this.x = -this.radius;
        if (this.y < -this.radius) this.y = h + this.radius;
        if (this.y > h + this.radius) this.y = -this.radius;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.radius
        );
        gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.color.a})`);
        gradient.addColorStop(0.6, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.color.a * 0.4})`);
        gradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }
}
