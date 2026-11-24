import { useEffect, useState } from "react";

/** 读取网址 # 后面的部分，并在它变化时让组件重新渲染 */
export function useHash(): string {
    const [hash, setHash] = useState(window.location.hash);
    useEffect(() => {
        const onChange = () => setHash(window.location.hash);
        window.addEventListener("hashchange", onChange);
        return () => window.removeEventListener("hashchange", onChange);
    }, []);
    return hash;
}
