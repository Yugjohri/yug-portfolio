/**
 * Technology logos for the stack: the brands' own colour marks, as static
 * SVG files in assets/tech (cropped to their painted bounds, artwork as
 * published). Sources: Devicon's colour originals (https://devicon.dev, MIT);
 * Hugging Face's own brand asset; and, where a brand's mark is single-colour
 * and Devicon has none, Simple Icons (https://simpleicons.org, CC0) in the
 * brand's official colour.
 *
 * `aspect` is width over height of the painted bounds and `density` the
 * share of those bounds the mark fills, both measured in the browser: the
 * stack sizes each logo from them so a solid square and a thin outline read
 * at about the same weight, none of them stretched.
 */

import python from '../assets/tech/python.svg'
import cplusplus from '../assets/tech/cplusplus.svg'
import pytorch from '../assets/tech/pytorch.svg'
import react from '../assets/tech/react.svg'
import langchain from '../assets/tech/langchain.svg'
import postgresql from '../assets/tech/postgresql.svg'
import huggingface from '../assets/tech/huggingface.svg'
import typescript from '../assets/tech/typescript.svg'
import javascript from '../assets/tech/javascript.svg'
import supabase from '../assets/tech/supabase.svg'
import nodedotjs from '../assets/tech/nodedotjs.svg'
import ollama from '../assets/tech/ollama.svg'
import docker from '../assets/tech/docker.svg'
import git from '../assets/tech/git.svg'
import pandas from '../assets/tech/pandas.svg'
import gsap from '../assets/tech/gsap.svg'
import java from '../assets/tech/java.svg'
import unrealengine from '../assets/tech/unrealengine.svg'
import openai from '../assets/tech/openai.svg'
import numpy from '../assets/tech/numpy.svg'

export type TechLogo = { src: string; aspect: number; density: number }

export const TECH_LOGOS: Record<string, TechLogo> = {
  python: { src: python, aspect: 0.909, density: 0.58 }, // Devicon
  cplusplus: { src: cplusplus, aspect: 0.890, density: 0.765 }, // Devicon
  pytorch: { src: pytorch, aspect: 0.827, density: 0.269 }, // Devicon
  react: { src: react, aspect: 1.122, density: 0.328 }, // Devicon
  langchain: { src: langchain, aspect: 0.728, density: 0.534 }, // Simple Icons
  postgresql: { src: postgresql, aspect: 0.969, density: 0.718 }, // Devicon
  huggingface: { src: huggingface, aspect: 1.084, density: 0.791 }, // Hugging Face
  typescript: { src: typescript, aspect: 0.998, density: 0.998 }, // Devicon
  javascript: { src: javascript, aspect: 1.000, density: 0.996 }, // Devicon
  supabase: { src: supabase, aspect: 0.975, density: 0.411 }, // Devicon
  nodedotjs: { src: nodedotjs, aspect: 0.873, density: 0.76 }, // Devicon
  ollama: { src: ollama, aspect: 0.757, density: 0.282 }, // Simple Icons
  docker: { src: docker, aspect: 1.761, density: 0.487 }, // Devicon
  git: { src: git, aspect: 1.000, density: 0.46 }, // Devicon
  pandas: { src: pandas, aspect: 0.630, density: 0.456 }, // Devicon
  gsap: { src: gsap, aspect: 2.703, density: 0.625 }, // Simple Icons
  java: { src: java, aspect: 0.738, density: 0.162 }, // Devicon
  unrealengine: { src: unrealengine, aspect: 1.000, density: 0.221 }, // Devicon
  openai: { src: openai, aspect: 0.987, density: 0.381 }, // Simple Icons
  numpy: { src: numpy, aspect: 0.937, density: 0.479 }, // Devicon
}
