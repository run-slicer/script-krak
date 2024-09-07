import type { Disassembler, Script, ScriptContext } from "@run-slicer/script";
import { wrap } from "comlink";
import type { Worker } from "./worker";

const worker = wrap<Worker>(new Worker(new URL("./worker.js", import.meta.url)));

const krak: Disassembler = {
    id: "krak",
    label: "Krakatau",
    language: "java",
    run: worker.run,
};

export default {
    name: "krak",
    description: "A script binding for the Krakatau Java decompiler.",
    version: __SCRIPT_VERSION__,
    load(context: ScriptContext): void | Promise<void> {
        context.disasm.add(krak);
    },
    unload(context: ScriptContext): void | Promise<void> {
        context.disasm.remove(krak.id);
    },
} satisfies Script;
