import type { Disassembler, Script, ScriptContext } from "@run-slicer/script";
import { wrap } from "comlink";
import type { Worker as KrakWorker } from "./worker";

// bypass cross-origin limitation
const loadWorker = async (url: URL): Promise<Worker> => {
    const response = await fetch(url);
    if (!response.ok) {
        console.error(response);
        throw new Error(`Failed to fetch worker`);
    }

    const script = await response.text();

    return new Worker(URL.createObjectURL(new Blob([script], { type: "application/javascript" })), { type: "module" });
};

const worker = wrap<KrakWorker>(await loadWorker(new URL("./worker.js", import.meta.url)));

const krak: Disassembler = {
    id: "krak",
    label: "Krakatau",
    language: "java",
    run: worker.decompile,
};

const krakAsm: Disassembler = {
    id: "krak-asm",
    label: "Krakatau (ASM)",
    run: worker.disassemble,
};

export default {
    name: "krak",
    description: "A script binding for the Krakatau Java decompiler and disassembler.",
    version: __SCRIPT_VERSION__,
    load(context: ScriptContext): void | Promise<void> {
        context.disasm.add(krak);
        context.disasm.add(krakAsm);
    },
    unload(context: ScriptContext): void | Promise<void> {
        context.disasm.remove(krak.id);
        context.disasm.remove(krakAsm.id);
    },
} satisfies Script;
