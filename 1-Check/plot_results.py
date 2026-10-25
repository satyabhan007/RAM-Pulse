import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

def generate_plots():
    # Read the data
    df = pd.read_csv('1-Check/results.csv')

    # Calculate summary statistics
    summary = df.groupby('Method')['Latency_ms'].agg(['mean', 'std', 'median']).reset_index()
    print("Summary Statistics (Latency in ms):")
    print(summary)

    # Write summary to a markdown table file for easy inclusion
    with open('1-Check/summary_stats.md', 'w') as f:
        f.write(summary.to_markdown(index=False))

    # Set style
    sns.set_theme(style="whitegrid")

    # Create the plot
    plt.figure(figsize=(10, 6))

    # Use a box plot to show the distribution
    ax = sns.boxplot(x='Method', y='Latency_ms', data=df, showfliers=False)

    # Add a swarm plot to show individual points (optional, might be too crowded with 1000 points per method)
    # sns.stripplot(x='Method', y='Latency_ms', data=df, color='black', alpha=0.3, ax=ax)

    # Add labels and title
    plt.title('Memory Telemetry Methods Latency Comparison', fontsize=16)
    plt.xlabel('Telemetry Method', fontsize=14)
    plt.ylabel('Latency (ms)', fontsize=14)

    # Customize x-axis labels
    ax.set_xticklabels(['OS Module', 'Proc Meminfo', 'Shell Process'])

    # Use log scale for y-axis since shell process might be orders of magnitude slower
    plt.yscale('log')
    plt.ylabel('Latency (ms) - Log Scale', fontsize=14)

    # Save the plot
    plt.tight_layout()
    plt.savefig('1-Check/latency_plot.png', dpi=300)
    print("Plot saved to 1-Check/latency_plot.png")

if __name__ == '__main__':
    generate_plots()
