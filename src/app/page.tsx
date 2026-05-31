import Navbar from "@/components/Navbar";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Channels from "@/components/sections/Channels";
import WhyHag from "@/components/sections/WhyHag";
import HowWeWork from "@/components/sections/HowWeWork";
import WhoWeWorkWith from "@/components/sections/WhoWeWorkWith";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/sections/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Channels />
        <WhyHag />
        <HowWeWork />
        <WhoWeWorkWith />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
