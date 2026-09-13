'use client';
import {usePathname} from 'next/navigation';
export default function AppFrame({children}:{children:React.ReactNode}){const path=usePathname();return <div className={path.startsWith('/admin')?'mx-auto max-w-6xl':'mx-auto max-w-md'}>{children}</div>;}
