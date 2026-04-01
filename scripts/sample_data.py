from datasets import load_dataset

def sample_epstein(n=1000, seed=42):
    dataset = load_dataset("notesbymuneeb/epstein-emails", split="train")
    sample = dataset.shuffle(seed=seed).select(range(n))
    sample.to_json(f"data/sample_{n}.json")

if __name__ == "__main__":
    sample_epstein()