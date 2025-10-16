import React from 'react';
import { Page } from '../types';

interface BottomNavProps {
    activePage: Page;
    onNavigate: (page: Page) => void;
}

interface NavItemProps {
    label: string;
    IconComponent: React.ElementType;
    isActive: boolean;
    onClick: () => void;
}

const HomeIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h7.5" /></svg>
);
const HistoryIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
const LeaveIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M-4.5 12h22.5" /></svg>
);
const SalaryIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.75A.75.75 0 013 4.5h.75m0 0a.75.75 0 01.75.75v.75m0 0a.75.75 0 01-.75.75h-.75m9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" /></svg>
);
const ProfileIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
);


const NavItem: React.FC<NavItemProps> = ({ label, IconComponent, isActive, onClick }) => {
    const activeClass = isActive ? 'text-sky-600' : 'text-slate-500';
    return (
        <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 w-full transition-colors duration-200 ease-in-out ${activeClass} hover:text-sky-500`}>
            <IconComponent className="w-6 h-6" />
            <span className="text-xs font-medium">{label}</span>
        </button>
    );
};

const BottomNav: React.FC<BottomNavProps> = ({ activePage, onNavigate }) => {
    const navItems = [
        { page: Page.HOME, label: 'Beranda', IconComponent: HomeIcon },
        { page: Page.HISTORY, label: 'Riwayat', IconComponent: HistoryIcon },
        { page: Page.LEAVE, label: 'Cuti', IconComponent: LeaveIcon },
        { page: Page.SALARY, label: 'Gaji', IconComponent: SalaryIcon },
        { page: Page.PROFILE, label: 'Profil', IconComponent: ProfileIcon },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-lg border-t border-slate-200 shadow-t-lg z-40">
            <div className="flex justify-around items-center h-full max-w-lg mx-auto px-2">
                {navItems.map(item => (
                    <NavItem
                        key={item.page}
                        label={item.label}
                        IconComponent={item.IconComponent}
                        isActive={activePage === item.page}
                        onClick={() => onNavigate(item.page)}
                    />
                ))}
            </div>
        </nav>
    );
};

export default BottomNav;