import Image from 'next/image'

export default function Home() {
  return (
    <div className="container">
      <Image
        src="/nino-idol.gif"
        alt="Centered Image"
        className="centered-image"
        width={1920}
        height={1080}
        priority
        unoptimized
      />
    </div>
  )
}